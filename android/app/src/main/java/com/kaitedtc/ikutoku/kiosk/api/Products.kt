package com.kaitedtc.ikutoku.kiosk.api

/**
 * 体験（おしながき）。コマはどれか1つの体験に属する。
 * shared/src/products.ts と同じ id・名前・並び順にする（サーバーは id だけを返す）。
 */
object Products {
    /** 料金（円・0 で無料）・対象年齢（〜歳以上）・持ち帰り・説明は案内に出すだけ */
    data class Product(
        val id: String,
        val name: String,
        val price: Int = 0,
        val minAge: Int? = null,
        val takeHome: Boolean = false,
        val description: String = "",
    ) {
        /** 例: 600円 ／ 6歳以上 ／ 持ち帰り○ */
        val info: String
            get() = listOfNotNull(
                if (price > 0) "%,d円".format(price) else "無料",
                minAge?.let { "${it}歳以上" },
                "持ち帰り" + if (takeHome) "○" else "×",
            ).joinToString(" ／ ")
    }

    val all = listOf(
        Product("programming", "プログラミング体験", 0, 4, false, "黒い線を道しるべにして走るロボットで、ロボットと一緒にゴールを目指そう！プログラミングがはじめてでも楽しめます。"),
        Product("buruburu", "ぶるぶるくん", 600, 6, true, "まるで虫みたいに振動するロボット。基板へのはんだ付けを体験して、自由にデコレーションしよう！"),
        Product("sumo", "相撲ロボット", 1800, 5, true, "木のパーツをネジでとめて組み立て、モータで歩く仕組みを体験。作ったロボットで勝負できます！"),
    )

    /** 体験。知らない id（サーバーに体験が増えたとき）は名前だけ */
    fun of(id: String): Product = all.firstOrNull { it.id == id } ?: Product(id, id)

    /** 体験名。知らない id はそのまま出す */
    fun name(id: String): String = of(id).name

    /** コマを体験ごとに分ける。並びは all の順で、知らない体験は後ろ。コマの無い体験は出さない */
    fun group(slots: List<Slot>): List<Pair<String, List<Slot>>> {
        val known = all.map { it.id }
        return slots.groupBy { it.product }.entries
            .sortedBy { (id, _) -> known.indexOf(id).let { if (it < 0) known.size else it } }
            .map { (id, list) -> id to list }
    }
}
