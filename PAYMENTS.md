# Kumbuild — Payments (Razorpay)

Status: **LOCKED (2026-11-09) — payment provider Razorpay hai.**
Fees Exa se verify ki gayi hain — Razorpay pricing page (last updated May 2026) aur Razorpay blog (2026-02-13, 2026-09-21). Activation ke time current rate card dobara check karna hai, kyunki offer / rate badal sakta hai.

## Provider

**Razorpay** — India ka payment gateway. Customer UPI, cards, netbanking aur wallets se pay kar sakta hai. Kumbuild ko alag-alag payment apps jodne ki zaroorat nahi hai — sab Razorpay Checkout se aayega.

## Customer kaise pay karega?

Razorpay Checkout se — order karte time ek payment window khulegi:

- **UPI** — Google Pay, PhonePe, Paytm, BHIM, etc.
- **Cards** — Visa, Mastercard, RuPay, Amex, Diners (debit + credit)
- **Netbanking** — 72+ banks
- **Wallets** — MobiKwik, Freecharge, Jio, Airtel, PayZapp, etc.
- **Pay Later / EMI** — ICICI, HDFC, LazyPay, Simpl, etc. (EMI pe alag fee ho sakti hai — detail pricing page pe)

Customer ka card number / UPI PIN Kumbuild kabhi nahi dekhega aur na hi store karega — ye sab Razorpay ke secure page pe hoga.

## Fees — kya katega?

Razorpay standard domestic pricing (pricing page, May 2026):

| Item | Rate |
|---|---|
| Platform fee (saare domestic methods) | 2% per successful transaction |
| GST on platform fee | 18% (fee pe, transaction amount pe nahi) |
| Setup fee | ₹0 |
| Annual Maintenance Charge (AMC) | ₹0 |
| Refund processing fee | ₹0 |

Matlab har successful payment pe total cost = **2% + us pe 18% GST = 2.36%** transaction amount ka.

### Package-wise cost (estimate — rate card ke hisaab se)

| Payment | Amount | Razorpay fee (2%) | GST (18% on fee) | Total fee | Kumbuild ko milega (approx) |
|---|---|---|---|---|---|
| Starter advance (50%) | ₹1,999.50 | ₹39.99 | ₹7.20 | ₹47.19 | ₹1,952.31 |
| Starter full | ₹3,999 | ₹79.98 | ₹14.40 | ₹94.38 | ₹3,904.62 |
| Business full | ₹7,999 | ₹159.98 | ₹28.80 | ₹188.78 | ₹7,810.22 |
| Premium full | ₹14,999 | ₹299.98 | ₹54.00 | ₹353.98 | ₹14,645.02 |
| Renewal | ₹1,999 | ₹39.98 | ₹7.20 | ₹47.18 | ₹1,951.82 |

Note: advance aur final alag-alag transactions hain, isliye fee dono pe alag se kategi. Upar wala "full" sirf ek baar me poora pay karne ka estimate hai.

**Important:** fee Kumbuild ke hisse se kategi — customer se package price se zyada nahi liya jayega. Pricing final karte time ye cost ginni hai (PLAN.md me bhi likha hai).

### 0% offer — check karna hai, bharosa mat karo

Razorpay blog ke hisaab se 1 July 2026 ke baad KYC karke activate karne wale naye merchants ko 0% platform fee mil sakti hai — ₹5 lakh GMV ya 90 din tak (jo pehle ho). Isme kuch methods excluded hain (prepaid cards, corporate cards, Amex, Diners, EMI, international). **Ye offer activation ke time check karna hai — is doc me ise guaranteed mat samjho.** Agar offer mile to upar wali fee us period me nahi kategi, par GST ka rule offer ki terms se check karna hai.

## Settlement

- Fees transaction se kaat ke baaki amount Kumbuild ke bank account me settle hoga
- Standard settlement T+1 hai (pricing page ke hisaab se). Instant settlement alag add-on hai, uski alag pricing hai — abhi zaroorat nahi hai.
- Settlement ke liye Razorpay account me bank details + KYC poora karna hoga.

## Integration — backend banega tab (plan)

Backend **Go** me banega (planned, API `api.kumbuild.com` pe). Frontend phase me payment mock hoga. Backend (`backend/payments/`) banega tab ye hoga:

1. Order banta hai → backend Razorpay Order banata hai (amount paise me — ₹1 = 100 paise, jaise ₹3,999 = 399900 paise)
2. Frontend Razorpay Checkout kholta hai — customer UPI / card se pay karta hai
3. Payment success pe Razorpay signature verify hoti hai (backend pe — frontend pe kabhi nahi)
4. Verify hone ke baad hi order ka status `Paid` hoga aur kaam shuru hoga
5. Webhook se payment status confirm hoga (network fail ho to bhi status sahi rahe)

**Kabhi bhi frontend se aayi "payment ho gaya" baat pe bharosa karke kaam shuru mat karo.** Sirf backend verification / webhook ke baad.

## Secrets — kaise rakhenge

| Secret | Kahan rahega |
|---|---|
| Razorpay Key ID (`rzp_test_...` / `rzp_live_...`) | Backend env / GitHub Secrets — public Checkout me Key ID use hoti hai, ye secret nahi hai par code me hardcode mat karo |
| Razorpay Key Secret | **Sirf backend env / GitHub Secrets me** — kabhi frontend code, repo, ya chat me nahi |
| Webhook Secret | Sirf backend env me |

- Test mode pehle: `rzp_test_` keys se test payment karke flow check karo, phir live keys pe jao
- Key Secret leak ho jaye to turant Razorpay dashboard se regenerate karo
- User (Dus) khud Razorpay account banayega aur keys add karega — assistant account nahi chhedega

## KYC — account activate karne se pehle

Razorpay account activate karne ke liye business KYC karna hoga — business details, bank account, PAN / GST (jo bhi Razorpay maange). KYC poora hue bina live payment nahi chalega. Ye kaam user khud karega, assistant nahi.

## Refunds — Razorpay se

- Refund Razorpay dashboard / API se hoga — detail `REFUND.md` me hai
- Refund processing fee ₹0 hai (pricing page)
- Refund usi payment method pe jayega jis se payment aaya tha
- Original transaction pe kati platform fee ka treatment Razorpay dashboard / activation ke time confirm karna hai — is doc me uska claim nahi kiya gaya hai

## Kya Razorpay nahi karega?

- Razorpay sirf payment lega — order, delivery, website banana Kumbuild ka kaam hai
- Razorpay customer support nahi dega — payment fail ho to customer Kumbuild ko bolega, Kumbuild Razorpay dashboard se check karega
- International payments alag pricing pe hain — Kumbuild ke customer India ke hain, isliye domestic pricing hi use hogi

## Open items

- [ ] Razorpay account banana + KYC karna (user khud)
- [ ] Test keys se payment flow test karna (backend banne pe)
- [ ] Live keys GitHub Secrets / backend env me add karna (user khud)
- [ ] Activation ke time current rate card + 0% offer check karna
- [ ] Webhook URL set karna (backend banne pe)
