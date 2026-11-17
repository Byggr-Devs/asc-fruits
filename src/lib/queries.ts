import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { supabase } from './supabase'
import type {
  CurrentStock,
  DailyReportRow,
  DeliveryListRow,
  Fruit,
  Location,
  OrderDetail,
  OrderListRow,
  OrderStatus,
  StockMovement,
  Variety,
  Vendor,
  VendorVariety,
} from './types'

async function run<T>(promise: PromiseLike<{ data: unknown; error: unknown }>): Promise<T> {
  const { data, error } = await promise
  if (error) throw error
  return data as T
}

export const keys = {
  fruits: ['fruits'] as const,
  varieties: ['varieties'] as const,
  vendors: ['vendors'] as const,
  vendorVarieties: ['vendor_varieties'] as const,
  locations: ['locations'] as const,
  orders: ['orders'] as const,
  deliveries: ['deliveries'] as const,
  stock: ['stock'] as const,
}

export function useFruits() {
  return useQuery({
    queryKey: keys.fruits,
    queryFn: () =>
      run<Fruit[]>(supabase.from('fruits').select('*').order('sort_order').order('name')),
  })
}

export function useVarieties() {
  return useQuery({
    queryKey: keys.varieties,
    queryFn: () => run<Variety[]>(supabase.from('varieties').select('*').order('name')),
  })
}

export type CatalogVariety = Variety & { fruit: Fruit }

/** Fruits and varieties joined, with lookup maps. */
export function useCatalog() {
  const fruits = useFruits()
  const varieties = useVarieties()
  const value = useMemo(() => {
    const fruitList = fruits.data ?? []
    const fruitById = new Map(fruitList.map((f) => [f.id, f]))
    const varietyList: CatalogVariety[] = (varieties.data ?? [])
      .filter((v) => fruitById.has(v.fruit_id))
      .map((v) => ({ ...v, fruit: fruitById.get(v.fruit_id)! }))
    const varietyById = new Map(varietyList.map((v) => [v.id, v]))
    return { fruits: fruitList, fruitById, varieties: varietyList, varietyById }
  }, [fruits.data, varieties.data])
  return {
    ...value,
    isLoading: fruits.isLoading || varieties.isLoading,
    error: fruits.error ?? varieties.error,
  }
}

export function useVendors() {
  return useQuery({
    queryKey: keys.vendors,
    queryFn: () => run<Vendor[]>(supabase.from('vendors').select('*').order('name')),
  })
}

export function useVendorVarieties() {
  return useQuery({
    queryKey: keys.vendorVarieties,
    queryFn: () => run<VendorVariety[]>(supabase.from('vendor_varieties').select('*')),
  })
}

export function useLocations() {
  return useQuery({
    queryKey: keys.locations,
    queryFn: () =>
      run<Location[]>(
        supabase.from('locations').select('*').order('sort_order').order('name'),
      ),
  })
}

export function useActiveLocations() {
  const locations = useLocations()
  return {
    ...locations,
    data: (locations.data ?? []).filter((l) => l.active),
  }
}

export function useOrders(status: OrderStatus | 'all') {
  return useQuery({
    queryKey: [...keys.orders, 'list', status],
    queryFn: () => {
      let q = supabase
        .from('orders')
        .select('*, vendor:vendors(id, name, name_ta), order_items(qty_kg, line_total)')
        .order('created_at', { ascending: false })
        .limit(500)
      if (status !== 'all') q = q.eq('status', status)
      return run<OrderListRow[]>(q)
    },
  })
}

export function useOrder(id: string | undefined) {
  return useQuery({
    queryKey: [...keys.orders, 'detail', id],
    enabled: !!id,
    queryFn: () =>
      run<OrderDetail>(
        supabase
          .from('orders')
          .select('*, vendor:vendors(*), delivery:deliveries(delivery_no), order_items(*)')
          .eq('id', id!)
          .single(),
      ),
  })
}

export function usePendingOrdersForVendor(vendorId: string | null) {
  return useQuery({
    queryKey: [...keys.orders, 'pending', vendorId],
    enabled: !!vendorId,
    queryFn: () =>
      run<OrderDetail[]>(
        supabase
          .from('orders')
          .select('*, vendor:vendors(*), delivery:deliveries(delivery_no), order_items(*)')
          .eq('vendor_id', vendorId!)
          .eq('status', 'pending')
          .order('created_at'),
      ),
  })
}

export function usePendingOrderCount() {
  return useQuery({
    queryKey: [...keys.orders, 'pending-count'],
    queryFn: async () => {
      const { count, error } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'pending')
      if (error) throw error
      return count ?? 0
    },
  })
}

export function useDeliveries() {
  return useQuery({
    queryKey: [...keys.deliveries, 'list'],
    queryFn: () =>
      run<DeliveryListRow[]>(
        supabase
          .from('deliveries')
          .select(
            '*, vendor:vendors(id, name, name_ta), delivery_items(variety_id, qty_kg, delivery_item_allocations(location_id, qty_kg, location:locations(id, name, name_ta))), orders(id, order_no)',
          )
          .order('received_at', { ascending: false })
          .limit(500),
      ),
  })
}

export function useCurrentStock() {
  return useQuery({
    queryKey: [...keys.stock, 'current'],
    queryFn: () =>
      run<CurrentStock[]>(
        supabase
          .from('current_stock')
          .select('*')
          .order('location_sort_order')
          .order('fruit_name')
          .order('variety_name'),
      ),
  })
}

export function useMovements(filters: {
  from?: string
  to?: string
  type?: 'receipt' | 'adjustment' | 'transfer' | 'all'
  locationId?: string | 'all'
  limit?: number
}) {
  return useQuery({
    queryKey: [...keys.stock, 'movements', filters],
    queryFn: () => {
      let q = supabase
        .from('stock_movements')
        .select('*, delivery:deliveries(delivery_no), location:locations(id, name, name_ta)')
        .order('created_at', { ascending: false })
        .limit(filters.limit ?? 500)
      if (filters.from) q = q.gte('created_at', filters.from)
      if (filters.to) q = q.lt('created_at', filters.to)
      if (filters.type && filters.type !== 'all') q = q.eq('type', filters.type)
      if (filters.locationId && filters.locationId !== 'all') q = q.eq('location_id', filters.locationId)
      return run<StockMovement[]>(q)
    },
  })
}

export function useDailyReport(day: string, locationId: string | null = null) {
  return useQuery({
    queryKey: [...keys.stock, 'daily', day, locationId],
    queryFn: () =>
      run<DailyReportRow[]>(
        supabase.rpc('daily_report', { day, p_location_id: locationId }),
      ),
  })
}
