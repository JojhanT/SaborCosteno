export type OrderType = 'mesa' | 'llevar' | 'domicilio';
export type OrderStatus = 'recibido' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
export type PaymentMethod = 'efectivo' | 'nequi' | 'daviplata' | 'tarjeta' | 'transferencia';
export type SauceMode = 'con' | 'aparte';
export type ImageFit = 'cover' | 'contain';

export interface Settings {
  businessName: string;
  slogan: string;
  tables: number;
  timezone: string;
  dayCutoffHour: number;
  deliveryFeePresets: number[];
  defaultDeliveryFee: number;
  kitchenWarnMinutes: number;
  kitchenLateMinutes: number;
  showDeliveryOnTurns: boolean;
  turnsScreenEnabled: boolean;
  turnsMarquee: string[];
  voiceNew: string;
  voiceReady: string;
  voiceKitchen: string;
}

export interface Category {
  id: number;
  name: string;
  icon: string;
  image: string | null;
  imageFit: ImageFit;
  sort: number;
  active: boolean;
}

export interface ProductOption {
  name: string;
  price: number | null;
}

export interface Product {
  id: number;
  categoryId: number;
  name: string;
  description: string;
  price: number;
  cost: number | null;
  icon: string;
  image: string | null;
  imageFit: ImageFit;
  optionsLabel: string;
  options: ProductOption[];
  ingredients: string[];
  allowSauces: boolean;
  allowExtras: boolean;
  featured: boolean;
  active: boolean;
  sort: number;
}

export interface Sauce {
  id: number;
  name: string;
  color: string;
  sort: number;
  active: boolean;
}

export interface Extra {
  id: number;
  name: string;
  price: number;
  sort: number;
  active: boolean;
}

export interface Catalog {
  categories: Category[];
  products: Product[];
  sauces: Sauce[];
  extras: Extra[];
}

export interface ItemSauce {
  id: number;
  name: string;
  color: string;
  mode: SauceMode;
}

export interface ItemExtra {
  id: number;
  name: string;
  price: number;
}

export interface OrderItem {
  id: number;
  productId: number;
  categoryId: number;
  categoryName: string;
  name: string;
  icon: string;
  image: string | null;
  imageFit: ImageFit;
  optionLabel: string;
  optionName: string;
  qty: number;
  unitPrice: number;
  lineTotal: number;
  removed: string[];
  aparte: string[];
  sauces: ItemSauce[];
  extras: ItemExtra[];
  note: string;
  createdAt: number;
}

export interface Order {
  id: number;
  turn: number;
  businessDay: string;
  type: OrderType;
  tableNumber: number | null;
  customerName: string;
  phone: string;
  address: string;
  addressRef: string;
  deliveryFee: number;
  note: string;
  status: OrderStatus;
  subtotal: number;
  total: number;
  paid: boolean;
  paymentMethod: PaymentMethod | null;
  amountReceived: number | null;
  change: number;
  editCount: number;
  cancelReason: string;
  createdAt: number;
  updatedAt: number;
  readyAt: number | null;
  deliveredAt: number | null;
  paidAt: number | null;
  cancelledAt: number | null;
  /** Repartidor que lleva el domicilio (si se despachó con uno). */
  courierId: number | null;
  courierName: string;
  dispatchedAt: number | null;
  createdByName: string;
  paidByName: string;
  items: OrderItem[];
}

export type LiveEventKind = 'created' | 'updated' | 'status' | 'paid' | 'unpaid' | 'cancelled' | 'call' | 'dispatched';

export type Role = 'admin' | 'cajero' | 'cocinero' | 'repartidor';

export interface Actor {
  id: number;
  name: string;
  role: Role;
}

export interface LiveEvent {
  id: string;
  kind: LiveEventKind;
  at: number;
  orderId: number | null;
  turn: number | null;
  type: OrderType | null;
  tableNumber: number | null;
  customerName: string;
  status: OrderStatus | null;
  total: number;
  paid: boolean;
  courierId: number | null;
  courierName: string;
  prevCourierId: number | null;
  prevStatus?: OrderStatus;
  itemsChanged?: boolean;
  backToKitchen?: boolean;
  /** Quién hizo el cambio. */
  by: Actor | null;
  items: { qty: number; name: string; optionName: string; categoryId: number }[];
}

export interface Courier {
  id: number;
  name: string;
  phone: string;
  /** Domicilios que lleva en este momento. */
  active: number;
}

export interface Bootstrap {
  settings: Settings;
  catalog: Catalog;
  lan: string[];
  /** Corre en un servidor en internet (PUBLIC_URL): los enlaces no dependen del wifi. */
  online?: boolean;
  serverTime: number;
  nextTurn: number;
  businessDay: string;
}

export interface DaySummary {
  orders: number;
  cancelled: number;
  sales: number;
  pending: number;
  deliveryFees: number;
  avgTicket: number;
  avgPrepMinutes: number | null;
  byMethod: Record<PaymentMethod, number>;
  byType: Record<OrderType, number>;
  byCourier: { id: number; name: string; orders: number; delivered: number; total: number; pending: number }[];
  topProducts: { name: string; icon: string; qty: number; total: number }[];
}

/** Línea del pedido que se está armando en caja (antes de enviarlo). */
export interface CartLine {
  key: string;
  id?: number;
  productId: number;
  qty: number;
  option: string | null;
  removed: string[];
  aparte: string[];
  sauces: { id: number; mode: SauceMode }[];
  extras: number[];
  note: string;
}
