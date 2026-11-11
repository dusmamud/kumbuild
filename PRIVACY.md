# Kumbuild — Privacy Policy

Status: **DRAFT (2026-11-09). Ye legal document nahi hai aur legal advice bhi nahi hai. Website pe daalne se pehle user ko padh ke final karna hai, aur zaroorat pade to kisi lawyer se check karwana hai.**

Ye policy `kumbuild.com` aur uske subdomains (`account.kumbuild.com`, `admin.kumbuild.com`, `home.kumbuild.com`) pe lagu hogi. Customer ka account banta hai — customer `account.kumbuild.com` pe signup/login karta hai aur `home.kumbuild.com` pe apne orders dekhta hai.

## 1. Hum kaunsi information lete hain?

### Customer (website order karne wala) se

- Naam, phone number, email address (account ke liye — login/signup pe diye jate hain)
- Business ka naam, address, timing, services aur price
- WhatsApp number
- Business ki photos aur logo
- Order aur payment se judi details (kitna pay kiya, kab kiya — payment Razorpay se hoga, isliye card details Kumbuild kabhi nahi lega aur na hi store karega)

### Website visitor se (kumbuild.com dekhne wala)

- Contact / enquiry form me bhari gayi details — naam, phone, message
- Website kaise use ho rahi hai, iski basic analytics — tool TBD hai, isliye is policy me koi tool ka naam nahi likha gaya hai

## 2. Information ka use kis liye hota hai?

- Website banana aur deliver karna
- Order ka status batana aur preview link bhejna
- Payment lena aur receipt dena (Razorpay se)
- Support dena — customer ke message ka jawab dena
- Renewal ka reminder bhejna
- Website ko behtar banana (analytics — tool TBD)

Information ko kisi aur kaam ke liye use nahi kiya jayega.

## 3. Information kisko di jati hai?

- **Kisi ko bechi nahi jati.** Customer ki details kisi third party ko bechi nahi jayengi.
- **Service ke liye zaroori parties ko di jayegi:** hosting (Cloudflare), payment provider Razorpay, aur domain registrar (TBD). Ye parties sirf apna kaam karne ke liye data use karengi.
- **Kanoon ke hisaab se:** agar kanoon ya court order maange to information deni padegi.

## 4. Information kahan store hoti hai?

- Frontend Cloudflare pe host hoga (locked decision).
- Backend Go me banega (`api.kumbuild.com`, planned) — database abhi decide nahi hua (TBD). Backend banne ke baad is section me likha jayega ki data kahan store hota hai aur kitne time tak rakha jata hai.
- **Mock phase (abhi):** koi real backend nahi hai — login session aur signup sirf browser ke localStorage me rehte hain (demo ke liye). Ye data server pe nahi jata.
- Passwords plain text me kabhi store nahi kiye jayenge (backend banne pe hashing use hoga — ye commitment hai, implementation TBD hai).

## 5. Customer ke rights

Customer ye maang sakta hai:

- Apni details dekhna
- Galat details theek karwana
- Apni details delete karwana (website live hone ke baad delete karne pe kya hoga — renewal / live website ka kya hoga — ye policy final karte time likhni hai, TBD)

Request karne ke liye contact: TBD (email / WhatsApp — website launch se pehle bharna hai).

## 6. Cookies

Website pe cookies use hongi — login session (admin + customer, `account.kumbuild.com` se) ke liye aur website kaise use ho rahi hai ye samajhne ke liye. Mock phase me session browser ke localStorage me rehta hai (koi cookie nahi); production me Go backend HttpOnly session cookie use karega. Exact cookies ki list backend / analytics tool decide hone ke baad likhi jayegi (TBD).

## 7. Bachchon ka data

Ye service business ke liye hai, bachchon ke liye nahi hai. Account sirf business owner (18+) ke liye hai. (Ye line draft hai — Play Store listing me target audience 18+ rakha gaya tha, par Kumbuild ke liye ye abhi final nahi hua hai.)

## 8. Policy me badlav

Policy badle to website pe nayi date ke saath update kar di jayegi. Bade badlav ho to customer ko bataya jayega.

## 9. Contact

Privacy se juda koi sawaal ho to contact karo — email / WhatsApp TBD hai, launch se pehle bharna hai.

---

*Draft date: 2026-11-09. Last updated: TBD. Ye document website pe publish karne ke layak nahi hai jab tak user ise final na kar de.*
