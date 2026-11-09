// Mock data — frontend phase only (ARCHITECTURE.md Section 5).
// Koi backend nahi hai. Backend aane pe ye data packages/lib ke api-client
// se aayega; pages ka shape wahi rahega.
//
// Order status flow (PRICING.md / SUBDOMAINS.md):
// Received -> In progress -> Preview ready -> Revision -> Approved -> Live

export type OrderStatus =
  | "received"
  | "in-progress"
  | "preview-ready"
  | "revision"
  | "approved"
  | "live";

export const ORDER_STATUSES: OrderStatus[] = [
  "received",
  "in-progress",
  "preview-ready",
  "revision",
  "approved",
  "live",
];

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  received: "Received",
  "in-progress": "In progress",
  "preview-ready": "Preview ready",
  revision: "Revision",
  approved: "Approved",
  live: "Live",
};

export type PackageName = "Starter" | "Business" | "Premium";

export const PACKAGE_PRICE: Record<PackageName, number> = {
  Starter: 3999,
  Business: 7999,
  Premium: 14999,
};

export interface Order {
  id: string;
  businessName: string;
  businessType: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  packageName: PackageName;
  price: number;
  advancePaid: number;
  status: OrderStatus;
  orderedOn: string;
  revisionsUsed: number;
  previewUrl: string | null;
  liveUrl: string | null;
  renewalDate: string | null;
  notes: string;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  businessName: string;
  orders: number;
  joinedOn: string;
}

export interface Payment {
  id: string;
  orderId: string;
  businessName: string;
  kind: "Advance (50%)" | "Final (50%)" | "Renewal";
  amount: number;
  method: "UPI" | "Card" | "NetBanking";
  status: "Paid" | "Pending";
  date: string | null;
}

export const MOCK_CUSTOMER = {
  name: "Ramesh Sharma",
  email: "customer@example.com",
  phone: "+91 98765 43210",
  businessName: "Sharma General Store",
};

export const orders: Order[] = [
  {
    id: "ORD-1001",
    businessName: "Sharma General Store",
    businessType: "Shop",
    customerName: "Ramesh Sharma",
    customerEmail: "customer@example.com",
    customerPhone: "+91 98765 43210",
    packageName: "Business",
    price: 7999,
    advancePaid: 4000,
    status: "in-progress",
    orderedOn: "2026-11-02",
    revisionsUsed: 0,
    previewUrl: null,
    liveUrl: null,
    renewalDate: null,
    notes: "5 pages: Home, Products, About, Gallery, Contact. WhatsApp order button chahiye.",
  },
  {
    id: "ORD-1002",
    businessName: "Smile Dental Clinic",
    businessType: "Clinic",
    customerName: "Dr. Anita Verma",
    customerEmail: "anita@smiledental.example",
    customerPhone: "+91 98220 11111",
    packageName: "Premium",
    price: 14999,
    advancePaid: 7500,
    status: "preview-ready",
    orderedOn: "2026-10-28",
    revisionsUsed: 0,
    previewUrl: "https://preview.kumbuild.example/smile-dental",
    liveUrl: null,
    renewalDate: null,
    notes: "Booking/enquiry form + services catalogue. Hindi + English dono chahiye.",
  },
  {
    id: "ORD-1003",
    businessName: "Bright Future Tuition",
    businessType: "Tuition / Coaching",
    customerName: "Mohd. Imran",
    customerEmail: "imran@brightfuture.example",
    customerPhone: "+91 99301 22222",
    packageName: "Starter",
    price: 3999,
    advancePaid: 2000,
    status: "received",
    orderedOn: "2026-11-07",
    revisionsUsed: 0,
    previewUrl: null,
    liveUrl: null,
    renewalDate: null,
    notes: "1 page — classes, timings, fees, WhatsApp button.",
  },
  {
    id: "ORD-1004",
    businessName: "Glow Salon",
    businessType: "Salon",
    customerName: "Priya Nair",
    customerEmail: "priya@glowsalon.example",
    customerPhone: "+91 98111 33333",
    packageName: "Business",
    price: 7999,
    advancePaid: 4000,
    status: "revision",
    orderedOn: "2026-10-20",
    revisionsUsed: 1,
    previewUrl: "https://preview.kumbuild.example/glow-salon",
    liveUrl: null,
    renewalDate: null,
    notes: "Revision 1: hero photo badalni hai, services ki list update karni hai. 1 free revision bacha hai.",
  },
  {
    id: "ORD-1005",
    businessName: "Annapurna Restaurant",
    businessType: "Restaurant / Cafe",
    customerName: "Suresh Patel",
    customerEmail: "suresh@annapurna.example",
    customerPhone: "+91 98980 44444",
    packageName: "Premium",
    price: 14999,
    advancePaid: 7500,
    status: "approved",
    orderedOn: "2026-10-12",
    revisionsUsed: 2,
    previewUrl: "https://preview.kumbuild.example/annapurna",
    liveUrl: null,
    renewalDate: null,
    notes: "Customer ne approve kar diya. Final payment ke baad live hoga.",
  },
  {
    id: "ORD-1006",
    businessName: "Fashion Hub",
    businessType: "Shop",
    customerName: "Kavita Singh",
    customerEmail: "kavita@fashionhub.example",
    customerPhone: "+91 97170 55555",
    packageName: "Business",
    price: 7999,
    advancePaid: 4000,
    status: "live",
    orderedOn: "2026-09-25",
    revisionsUsed: 1,
    previewUrl: "https://preview.kumbuild.example/fashion-hub",
    liveUrl: "https://fashionhub.example",
    renewalDate: "2027-09-25",
    notes: "Live hai. Renewal 25 Sep 2027 ko due hai (₹1,999/year).",
  },
];

export const customers: Customer[] = [
  { id: "CUS-01", name: "Ramesh Sharma", email: "customer@example.com", phone: "+91 98765 43210", businessName: "Sharma General Store", orders: 1, joinedOn: "2026-11-02" },
  { id: "CUS-02", name: "Dr. Anita Verma", email: "anita@smiledental.example", phone: "+91 98220 11111", businessName: "Smile Dental Clinic", orders: 1, joinedOn: "2026-10-28" },
  { id: "CUS-03", name: "Mohd. Imran", email: "imran@brightfuture.example", phone: "+91 99301 22222", businessName: "Bright Future Tuition", orders: 1, joinedOn: "2026-11-07" },
  { id: "CUS-04", name: "Priya Nair", email: "priya@glowsalon.example", phone: "+91 98111 33333", businessName: "Glow Salon", orders: 1, joinedOn: "2026-10-20" },
  { id: "CUS-05", name: "Suresh Patel", email: "suresh@annapurna.example", phone: "+91 98980 44444", businessName: "Annapurna Restaurant", orders: 1, joinedOn: "2026-10-12" },
  { id: "CUS-06", name: "Kavita Singh", email: "kavita@fashionhub.example", phone: "+91 97170 55555", businessName: "Fashion Hub", orders: 1, joinedOn: "2026-09-25" },
];

export const payments: Payment[] = [
  { id: "PAY-01", orderId: "ORD-1001", businessName: "Sharma General Store", kind: "Advance (50%)", amount: 4000, method: "UPI", status: "Paid", date: "2026-11-02" },
  { id: "PAY-02", orderId: "ORD-1002", businessName: "Smile Dental Clinic", kind: "Advance (50%)", amount: 7500, method: "Card", status: "Paid", date: "2026-10-28" },
  { id: "PAY-03", orderId: "ORD-1003", businessName: "Bright Future Tuition", kind: "Advance (50%)", amount: 2000, method: "UPI", status: "Paid", date: "2026-11-07" },
  { id: "PAY-04", orderId: "ORD-1004", businessName: "Glow Salon", kind: "Advance (50%)", amount: 4000, method: "NetBanking", status: "Paid", date: "2026-10-20" },
  { id: "PAY-05", orderId: "ORD-1005", businessName: "Annapurna Restaurant", kind: "Advance (50%)", amount: 7500, method: "UPI", status: "Paid", date: "2026-10-12" },
  { id: "PAY-06", orderId: "ORD-1005", businessName: "Annapurna Restaurant", kind: "Final (50%)", amount: 7499, method: "UPI", status: "Pending", date: null },
  { id: "PAY-07", orderId: "ORD-1006", businessName: "Fashion Hub", kind: "Advance (50%)", amount: 4000, method: "Card", status: "Paid", date: "2026-09-25" },
  { id: "PAY-08", orderId: "ORD-1006", businessName: "Fashion Hub", kind: "Final (50%)", amount: 3999, method: "Card", status: "Paid", date: "2026-10-05" },
  { id: "PAY-09", orderId: "ORD-1006", businessName: "Fashion Hub", kind: "Renewal", amount: 1999, method: "UPI", status: "Pending", date: null },
];

export function getOrder(id: string): Order | undefined {
  return orders.find((o) => o.id.toLowerCase() === id.toLowerCase());
}

export function getCustomerOrders(email: string): Order[] {
  return orders.filter((o) => o.customerEmail === email);
}
