/** 体験（おしながき）。コマはどれか1つの体験に属する。並び順はポスターのおしながきのとおり */
export const PRODUCTS = [
  { id: 'programming', name: 'プログラミング体験' },
  { id: 'buruburu', name: 'ぶるぶるくん' },
  { id: 'sumo', name: '相撲ロボット' },
] as const

export type ProductId = (typeof PRODUCTS)[number]['id']

export const PRODUCT_IDS = PRODUCTS.map((p) => p.id) as [ProductId, ...ProductId[]]

export const productName = (id: ProductId) => PRODUCTS.find((p) => p.id === id)!.name
