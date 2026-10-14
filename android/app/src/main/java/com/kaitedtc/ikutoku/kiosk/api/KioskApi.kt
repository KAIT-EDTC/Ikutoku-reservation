package com.kaitedtc.ikutoku.kiosk.api

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

/** サーバーが返したエラー（{ error }）。401 = 未登録・無効化、409 = 満員・受付停止、400 = 入力不正 */
class ApiException(val status: Int, message: String) : Exception(message)

/**
 * 受付端末として使う API。ブラウザの /kiosk と同じものを、Cookie `dev` を自分で付けて呼ぶ。
 * 通信できなかったときは IOException（予約の送信後なら、予約できたか分からない）。
 * serverUrl・token は呼ぶたびに読む（係員メニューで変わるため）。Android に依存しないので JVM のテストから使える。
 */
class KioskApi(private val serverUrl: () -> String, private val token: () -> String?) {
    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(15, TimeUnit.SECONDS)
        .writeTimeout(15, TimeUnit.SECONDS)
        .build()

    /** 予約の送信用。勝手に送り直さない（届いていたら二重予約になる） */
    private val noRetry = client.newBuilder().retryOnConnectionFailure(false).build()

    private val json = Json { ignoreUnknownKeys = true }
    private val jsonType = "application/json".toMediaType()

    suspend fun load(date: String? = null): KioskData =
        call(get("/api/kiosk" + (date?.let { "?date=$it" } ?: ""), deviceCookie()))

    suspend fun reserve(slotId: Int, people: Int): Reservation {
        // 使い回した接続がサーバー側で閉じられていると、再送なしではそのまま失敗する。
        // 新しい接続で送り、失敗したら本当に「届いたか分からない」ときだけにする
        client.connectionPool.evictAll()
        val req = post("/api/kiosk/reservations", json.encodeToString(ReserveRequest.serializer(), ReserveRequest(slotId, people)), deviceCookie())
        return json.decodeFromString(send(req, noRetry).body)
    }

    /**
     * 端末登録（管理画面の「この端末を登録」と同じ）: ログイン → 端末を登録して Cookie `dev` を受け取る → ログアウト。
     * 返り値は端末トークン。
     */
    suspend fun register(otp: String, name: String): String {
        val login = send(post("/api/auth/login", json.encodeToString(LoginRequest.serializer(), LoginRequest(otp)), null))
        val session = login.cookie("admin_session") ?: throw ApiException(500, "ログインできませんでした")
        val sessionCookie = "admin_session=$session"
        try {
            val res = send(post("/api/admin/devices", json.encodeToString(DeviceNameRequest.serializer(), DeviceNameRequest(name)), sessionCookie))
            return res.cookie("dev") ?: throw ApiException(500, "端末トークンを受け取れませんでした")
        } finally {
            runCatching { send(post("/api/auth/logout", "{}", sessionCookie)) }
        }
    }

    private fun deviceCookie() = token()?.let { "dev=$it" }

    private fun get(path: String, cookie: String?) = request(path, cookie).get().build()

    // Content-Type: application/json が無いと Hono の csrf でフォーム扱いになり 403 になる
    private fun post(path: String, body: String, cookie: String?) = request(path, cookie).post(body.toRequestBody(jsonType)).build()

    private fun request(path: String, cookie: String?) = Request.Builder()
        .url(serverUrl() + path)
        .header("Accept", "application/json")
        .apply { cookie?.let { header("Cookie", it) } }

    private suspend inline fun <reified T> call(req: Request): T {
        val res = send(req)
        return json.decodeFromString(res.body)
    }

    /** 成功したら本文と Set-Cookie を返す。失敗は ApiException / IOException */
    private suspend fun send(req: Request, via: OkHttpClient = client): Result = withContext(Dispatchers.IO) {
        via.newCall(req).execute().use { res -> res.toResult() }
    }

    private fun Response.toResult(): Result {
        val text = body?.string().orEmpty()
        if (!isSuccessful) {
            val message = runCatching { json.decodeFromString(ErrorBody.serializer(), text).error }.getOrNull()
            throw ApiException(code, message?.takeIf { it.isNotBlank() } ?: "エラーが発生しました（$code）")
        }
        return Result(text, headers("Set-Cookie"))
    }

    class Result(val body: String, private val setCookies: List<String>) {
        /** Set-Cookie から name の値を取り出す（secure 属性つきでも http の開発サーバーで使えるよう自分で読む） */
        fun cookie(name: String): String? = setCookies
            .map { it.substringBefore(';') }
            .firstOrNull { it.substringBefore('=').trim() == name }
            ?.substringAfter('=')
            ?.takeIf { it.isNotEmpty() }
    }
}

/** 通信エラーを画面の文言にする */
fun Throwable.userMessage(): String = when (this) {
    is ApiException -> message ?: "エラーが発生しました"
    is IOException -> "サーバーに接続できません。\n通信状態を確認してください。"
    else -> "エラーが発生しました（${this::class.simpleName}）"
}
