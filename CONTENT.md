# Kumbuild — Content Requirements (Customer ko kya dena hoga)

Status: **DRAFT (2026-11-09)** — **2026-11-11 ko web project ke order form se match karke update kiya gaya**
(`frontend/apps/web/src/components/react/OrderForm.tsx`, order page, `how` steps, `en-US.json` order keys).
Ab ye doc form ka waada nahi, form + WhatsApp follow-up ka **asal flow** batata hai.

Content **do stage me** collect hota hai — (1) order form, (2) WhatsApp follow-up. Delivery (preview banane ka kaam)
tabhi shuru hogi jab **advance (50%) + poora content** mil jaye; preview **3–5 working days** me milta hai
(advance + poora content milne ke baad). Kuch missing ho to order ruk jayega aur delivery time aage badhega —
detail `DELIVERY.md` me hai.

## 1. Order form me kya bharna hai (pehla step — `kumbuild.com/order`)

Form me ye fields hain:

**Lazmi (\*):**

- Apna naam
- Phone number — kam se kam 10 digits (form validate karta hai)
- Business ka naam (website pe jo dikhega)
- Business kya karta hai — 1–2 lines me (message field)

**Optional / choice:**

- WhatsApp number — khali chhodo to phone number hi WhatsApp mana jata hai
- Business type — Shop, Clinic, Tuition / Coaching, Salon, Restaurant / Cafe, Other (6 options)
- Package — Starter / Business / Premium (default Business selected hota hai)
- Website language — English / हिन्दी / বাংলা (default page ki language)

Aur:

- Form me **payment nahi liya jata** — advance (50%) order confirm hone ke baad Razorpay se hota hai.
- Submit karne pe ek **reference number** milta hai (jaise `KB-XXXXXX`) — ise save karke rakhna hai.
- Note (current state): form abhi **mock** hai — submit karne pe data kahin nahi bhejta, sirf reference dikhata hai.
  Asli order WhatsApp follow-up se confirm hota hai (backend banne tak).

## 2. WhatsApp pe kya bhejna hai (doosra step — lazmi)

Form submit karne ke baad Kumbuild WhatsApp pe message karega — package confirm karne aur content collect karne
ke liye. Is stage pe ye chahiye:

- Services ki list — har service ka naam aur price (agar price dikhana ho to)
- Address — dukaan / clinic / centre kahan hai
- Timing — kab khulta hai, kab band hota hai
- Email address (agar ho to)

## 3. Photos (WhatsApp pe bhejni hain — lazmi)

- **Form me photo upload nahi hai** — photos WhatsApp pe bhejni hain.
- Dukaan / clinic / centre ki real photos — bahar se, andar se
- Products / kaam ki photos (jaisa ho — khana, kapde, kaam ke samples)
- Owner / team ki photo (agar About page pe dikhani ho to)

Photos ki quality:

- Phone se li hui clear photos chalengi — professional photoshoot ki zaroorat nahi hai
- Blurry ya bahut dark photos achhi nahi dikhengi — jitni clear photo, utni achhi website
- Kisi aur ki photo mat bhejo — sirf apni real photos bhejo

## 4. Logo (agar ho to — WhatsApp pe)

- Logo hai to bhej do — PNG format achha hai
- Logo nahi hai to koi baat nahi — website business ke naam se banegi, logo design is service me nahi hai

## 5. Social links (agar hon to — WhatsApp pe)

- Instagram page ka link
- Facebook page ka link
- Google Business Profile ka link (agar ho to)

## 6. Package ke hisaab se extra (WhatsApp pe)

| Package | Extra content |
|---|---|
| Starter | Upar wali basic details hi kaafi hain |
| Business | Gallery ke liye zyada photos, About ke liye business ki kahani (2–3 lines) |
| Premium | Booking ke liye services + timing detail, catalogue ke liye har product ka naam + price + photo |

## 7. Content bhejne ka tareeka (flow)

1. Order form bharo → reference number save karo.
2. Kumbuild WhatsApp pe message karega — package confirm + content collect.
3. Content WhatsApp pe bhejo (details, photos, logo, links).
4. Advance 50% (Razorpay) — order confirm hone ke baad.
5. Preview 3–5 working days me (advance + poora content milne ke baad) — order page pe "What happens next" bhi
   yahi dikhata hai: Tell us → Preview → Approve → Go live.

- Content Hindi ya English — dono chalega. Website ki language form me poochhi jati hai (English / हिन्दी / বাংলা) —
  pehle TBD tha, ab form me implement hai.

**Kya badla (2026-11-11 update):** pehle doc kehta tha *"form me photo upload hoga (frontend banne pe)"* — frontend
ban chuka hai, upload abhi bhi nahi hai. Isliye photos aur baaki details ab WhatsApp stage me likhi hain, form stage
me nahi. Form jo collect karta hai (§1) aur WhatsApp pe jo chahiye (§2–§6), ab dono alag-alag likhe hain.

## 8. Content ki zimmedari

- Content sahi hona chahiye — galat price ya timing likhi to website pe galat dikhega
- Photos aur text par customer ka haq hona chahiye — kisi aur ki copyrighted cheez mat bhejo
- Galat content se bani website ki zimmedari customer ki hogi — detail `TERMS.md` me hai
