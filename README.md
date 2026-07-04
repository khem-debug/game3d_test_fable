# ⌨️ LAYOFF SOULS — A Programmer vs The AI Demon

เกมแอ็กชัน 3 มิติสไตล์ **Dark Souls** เล่นบนเบราว์เซอร์ สร้างด้วย [Three.js](https://threejs.org/)

> ปี 2029 — ปีศาจ AI **NEXUS-9** ตื่นขึ้นในดาต้าเซ็นเตอร์ร้าง มันไล่กลืนกินอาชีพของเหล่าโปรแกรมเมอร์
> จนออฟฟิศกลายเป็นแดนมรณะ คุณคือ **Dev คนสุดท้าย** ที่ยังไม่ยอมเซ็นใบลาออก
> คว้าคีย์บอร์ดขึ้นมา… แล้วไปทวงงานของคุณคืน

โทนสี: **ส้ม / เทา / ขาว** (ตามแบรนด์ [anyimedia.com](https://www.anyimedia.com))

## 🎮 วิธีเล่น

รันเซิร์ฟเวอร์ static แล้วเปิดเบราว์เซอร์ (ต้องรันผ่าน server เพราะใช้ ES modules):

```bash
# ทางใดทางหนึ่ง
python3 -m http.server 8080
# หรือ
npx serve .
```

แล้วเปิด <http://localhost:8080>

## ⌨️ ปุ่มควบคุม

| ปุ่ม | การกระทำ |
|---|---|
| `W A S D` | เดิน |
| เมาส์ | หมุนกล้อง |
| `Shift` | วิ่ง (ใช้ stamina) |
| `Space` | กลิ้งหลบ — มี **i-frames** แบบ Dark Souls |
| คลิกซ้าย | ฟันเบา (คีย์บอร์ดกลจักรในตำนาน) |
| คลิกขวา | ฟันหนัก |
| `Q` | ล็อกเป้าหมาย / ยกเลิกล็อก |
| `F` | ดื่มกาแฟ ☕ ฟื้นเลือด (จำกัด 3 แก้ว เติมได้ที่ checkpoint) |
| `E` | ใช้งาน — พักที่ **Deploy Server** (bonfire) / เก็บ Lines of Code ที่ทำหล่น |

## 🔥 ระบบแบบ Souls

- **Stamina** — โจมตี กลิ้ง วิ่ง ล้วนกินพลัง บริหารให้ดี
- **Deploy Server (bonfire)** — พักเพื่อฟื้นเลือด เติมกาแฟ และเซฟจุดเกิด แต่ศัตรูจะเกิดใหม่ทั้งหมด
- **Lines of Code (souls)** — ฆ่าศัตรูได้แต้ม ตายแล้วแต้มหล่นไว้ตรงจุดตาย ต้องกลับไปเก็บ ตายซ้ำ = หายถาวร
- **YOU ARE FIRED** — จอตายสไตล์ Souls
- **บอส NEXUS-9 — Devourer of Careers** — 2 เฟส มีท่าทุบ (shockwave), ยิงกระสุนกระจาย และพุ่งชาร์จ

## 👾 ศัตรู

| ตัว | ลักษณะ |
|---|---|
| **Spam Bug** | แมลงกลไกวิ่งไล่กัดระยะประชิด |
| **Autocomplete Wraith** | โดรน AI ลอยได้ ยิงกระสุนพลังงานใส่ |
| **NEXUS-9** | ปีศาจ AI ตัวสุดท้าย — ผู้ทำให้คุณตกงาน |

## 🛠 โครงสร้างโปรเจกต์

```
index.html          หน้าเกม + HUD + จอ title/death/victory
vendor/three.module.js   Three.js r160 (vendored, เล่น offline ได้)
src/config.js       ค่าปรับสมดุลเกม + พาเลตสี ส้ม/เทา/ขาว
src/main.js         game loop, กล้อง, ระบบต่อสู้, checkpoint, บอส
src/world.js        สร้างฉากออฟฟิศร้าง + server racks + แสง
src/player.js       ตัวละครโปรแกรมเมอร์ + ระบบเคลื่อนไหว/สเตต
src/enemies.js      AI ศัตรู + บอส NEXUS-9
src/ui.js           HUD (เลือด/stamina/กาแฟ/บอสบาร์)
src/audio.js        เอฟเฟกต์เสียงแบบ procedural (WebAudio ไม่ใช้ไฟล์เสียง)
```

ไม่ต้อง build ไม่ต้อง `npm install` — เป็น vanilla ES modules ทั้งหมด
