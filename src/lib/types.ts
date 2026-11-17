export type Fruit = {
  id: string
  name: string
  name_ta: string | null
  emoji: string
  image_path: string | null
  active: boolean
  sort_order: number
}

export type Variety = {
  id: string
  fruit_id: string
  name: string
  name_ta: string | null
  emoji: string | null
  image_path: string | null
  active: boolean
}

export type Vendor = {
  id: string
  name: string
  name_ta: string | null
  contact_person: string | null
  phone: string | null
  whatsapp: string | null
  address: string | null
  notes: string | null
  active: boolean
  created_at: string
}

export type VendorVariety = { vendor_id: string; variety_id: string }

export type Location = {
  id: string
  slug: string | null
  name: string
  name_ta: string | null
  active: boolean
  sort_order: number
  created_at: string
}

export const GODOWN_LOCATION_ID = 'a0000000-0000-4000-8000-000000000001'

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
  vendor: Pick<Vendor, 'id' | 'name' | 'name_ta'> | null
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

export type DeliveryItemAllocation = {
  location_id: string
  qty_kg: number
  location?: Pick<Location, 'id' | 'name' | 'name_ta'> | null
}

export type DeliveryListRow = Delivery & {
  vendor: Pick<Vendor, 'id' | 'name' | 'name_ta'> | null
  delivery_items: {
    variety_id: string
    qty_kg: number
    delivery_item_allocations?: DeliveryItemAllocation[]
  }[]
  orders: { id: string; order_no: number }[]
}

export type MovementType = 'receipt' | 'adjustment' | 'transfer'
export type AdjustmentReason = 'wastage' | 'correction' | 'other'

export type StockMovement = {
  id: string
  variety_id: string
  qty_kg: number
  type: MovementType
  reason: AdjustmentReason | null
  delivery_id: string | null
  location_id: string
  transfer_group_id: string | null
  note: string | null
  created_at: string
  delivery: { delivery_no: number } | null
  location?: Pick<Location, 'id' | 'name' | 'name_ta'> | null
}

export type CurrentStock = {
  variety_id: string
  variety_name: string
  variety_name_ta: string | null
  variety_emoji: string | null
  variety_image_path: string | null
  fruit_id: string
  fruit_name: string
  fruit_name_ta: string | null
  fruit_emoji: string
  fruit_image_path: string | null
  location_id: string
  location_name: string
  location_name_ta: string | null
  location_slug: string | null
  location_sort_order: number
  qty_kg: number
  last_movement_at: string | null
}

export type DailyReportRow = {
  variety_id: string
  variety_name: string
  variety_name_ta: string | null
  fruit_name: string
  fruit_name_ta: string | null
  fruit_emoji: string
  location_id: string
  location_name: string
  location_name_ta: string | null
  opening_kg: number
  received_kg: number
  adjusted_kg: number
  transferred_kg: number
  closing_kg: number
}
