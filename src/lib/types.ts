export type Fruit = {
  id: string
  name: string
  emoji: string
  image_path: string | null
  active: boolean
  sort_order: number
}

export type Variety = {
  id: string
  fruit_id: string
  name: string
  emoji: string | null
  image_path: string | null
  active: boolean
}

export type Vendor = {
  id: string
  name: string
  contact_person: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export type VendorVariety = { vendor_id: string; variety_id: string }

export type OrderStatus = 'pending' | 'fulfilled' | 'cancelled'

export type OrderItem = {
  id: string
  order_id: string
  variety_id: string
  qty_kg: number
  rate: number
  line_total: number
  fulfilled_qty_kg: number | null
}

export type Order = {
  id: string
  order_no: number
  vendor_id: string
  status: OrderStatus
  notes: string | null
  delivery_id: string | null
  created_at: string
  fulfilled_at: string | null
}

export type OrderListRow = Order & {
  vendor: Pick<Vendor, 'id' | 'name'> | null
  order_items: Pick<OrderItem, 'qty_kg' | 'line_total'>[]
}

export type OrderDetail = Order & {
  vendor: Vendor | null
  delivery: { delivery_no: number } | null
  order_items: OrderItem[]
}

export type Delivery = {
  id: string
  delivery_no: number
  vendor_id: string
  received_at: string
  notes: string | null
  created_at: string
}

export type DeliveryListRow = Delivery & {
  vendor: Pick<Vendor, 'id' | 'name'> | null
  delivery_items: { variety_id: string; qty_kg: number }[]
  orders: { id: string; order_no: number }[]
}

export type MovementType = 'receipt' | 'adjustment'
export type AdjustmentReason = 'wastage' | 'correction' | 'other'

export type StockMovement = {
  id: string
  variety_id: string
  qty_kg: number
  type: MovementType
  reason: AdjustmentReason | null
  delivery_id: string | null
  note: string | null
  created_at: string
  delivery: { delivery_no: number } | null
}

export type CurrentStock = {
  variety_id: string
  variety_name: string
  variety_emoji: string | null
  variety_image_path: string | null
  fruit_id: string
  fruit_name: string
  fruit_emoji: string
  fruit_image_path: string | null
  qty_kg: number
  last_movement_at: string | null
}

export type DailyReportRow = {
  variety_id: string
  variety_name: string
  fruit_name: string
  fruit_emoji: string
  opening_kg: number
  received_kg: number
  adjusted_kg: number
  closing_kg: number
}
