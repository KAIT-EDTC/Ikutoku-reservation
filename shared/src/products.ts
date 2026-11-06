/**
 * 体験（おしながき）。コマはどれか1つの体験に属する。並び順はポスターのおしながきのとおり。
 * 料金（円・0 で無料）・対象年齢（〜歳以上）・持ち帰り・説明は案内に出すだけ（予約の判定には使わない）。
 * 受付アプリ（android/…/api/Products.kt）にも同じ内容を書いているので、変えたら両方直す
 */
export const PRODUCTS = [
  {
    id: 'programming',
    name: 'プログラミング体験',
    price: 0,
    minAge: 4,
    takeHome: false,
    description: '黒い線を道しるべにして走るロボットで、ロボットと一緒にゴールを目指そう！プログラミングがはじめてでも楽しめます。',
  },
  {
    id: 'buruburu',
    name: 'ぶるぶるくん',
    price: 600,
    minAge: 6,
    takeHome: true,
    description: 'まるで虫みたいに振動するロボット。基板へのはんだ付けを体験して、自由にデコレーションしよう！',
  },
  {
    id: 'sumo',
    name: '相撲ロボット',
    price: 1800,
    minAge: 5,
    takeHome: true,
    description: '木のパーツをネジでとめて組み立て、モータで歩く仕組みを体験。作ったロボットで勝負できます！',
  },
] as const

export type ProductId = (typeof PRODUCTS)[number]['id']

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id) as [ProductId, ...ProductId[]]

export const productName = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!.name

/** 料金・対象年齢・持ち帰りを1行に。例: 600円 ／ 6歳以上 ／ 持ち帰り○ */
export const productInfo = (p: { price: number; minAge: number | null; takeHome: boolean }) =>
  [p.price ? `${p.price.toLocaleString()}円` : '無料', p.minAge != null ? `${p.minAge}歳以上` : null, `持ち帰り${p.takeHome ? '○' : '×'}`]
    .filter(Boolean)
    .join(' ／ ')
