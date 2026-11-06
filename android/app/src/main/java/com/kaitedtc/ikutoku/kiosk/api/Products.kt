package com.kaitedtc.ikutoku.kiosk.api

/**
 * 体験（おしながき）。コマはどれか1つの体験に属する。
 * shared/src/products.ts と同じ id・名前・並び順にする（サーバーは id だけを返す）。
 */
object Products {
    data class Product(val id: String, val name: String)

    val all = listOf(
        Product("programming", "プログラミング体験"),
        Product("buruburu", "ぶるぶるくん"),
        Product("sumo", "相撲ロボット"),
    )

    /** 体験名。知らない id（サーバーに体験が増えたとき）はそのまま出す */
    fun name(id: String): String = all.firstOrNull { it.id == id }?.name ?: id

    /** コマを体験ごとに分ける。並びは all の順で、知らない体験は後ろ。コマの無い体験は出さない */
    fun group(slots: List<Slot>): List<Pair<String, List<Slot>>> {
        val known = all.map { it.id }
        return slots.groupBy { it.product }.entries
            .sortedBy { (id, _) -> known.indexOf(id).let { if (it < 0) known.size else it } }
            .map { (id, list) -> id to list }
    }
}
