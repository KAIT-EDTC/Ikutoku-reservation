import type { ProductId } from '@ikutoku/shared'

/** おしながきの中身。文言・対象年齢・料金はポスター（EDTC-Ikutokusai-26s-poster.ai）のとおり。所要時間はポスターで未確定なので載せない */
export type ProductContent = {
  description: string
  age: string
  /** 料金。null は体験無料 */
  price: string | null
  takeHome: boolean
  photo: { src: string; alt: string }
}

export const PRODUCT_CONTENT: Record<ProductId, ProductContent> = {
  programming: {
    description: '黒い線が道しるべのライントレーサーと一緒にゴールをめざそう！プログラミングが初めてでも楽しめるプログラミング体験教室です！',
    age: '4歳〜',
    price: null,
    takeHome: false,
    photo: { src: '/mecademy/programming.webp', alt: 'ライントレーサー' },
  },
  buruburu: {
    description: 'まるで虫みたいに、振動で動くロボット！今回は基板にはんだ付けを体験できるよ。自由にデコレーションをして、世界にひとつのぶるぶるくんをつくろう！',
    age: '6歳〜',
    price: '700',
    takeHome: true,
    photo: { src: '/mecademy/buruburu.webp', alt: 'ぶるぶるくん' },
  },
  sumo: {
    description: '作って、学んで、戦える相撲ロボット！木のパーツをネジでとめて組み立てよう。モーターでロボットが歩く仕組みを体験！作った相撲ロボットで楽しく勝負出来ます。',
    age: '5歳〜',
    price: '1,800',
    takeHome: true,
    photo: { src: '/mecademy/sumo.webp', alt: '相撲ロボット' },
  },
}
