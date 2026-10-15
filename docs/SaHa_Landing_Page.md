
# 🌍 SaHa – Sustainable Habitats

## 🏗️ Build Sustainably. Measure What Matters.

**SaHa** helps architects, builders, and planners measure the carbon footprint of construction projects — in real-time.

### 🚀 Get Started
- [Start Calculating Emissions] → Sign In with Google
- [Explore Features]

---

## ❓ What is SaHa?

**SaHa (Sustainable Habitats)** is a web application designed to quantify and track the **carbon emissions** of construction projects based on material usage and project scope. Whether you’re an architect, estimator, builder, or sustainability consultant — _SaHa_ helps you make **climate-conscious decisions** right from the design table.

---

## 🌿 Core Features

- ✅ **Material Catalog with Real Emission Data**  
  Preloaded with data from ICE Database, editable for custom sources.

- ✅ **Live Emissions Calculator**  
  Get instant CO₂ estimates for your projects as you add materials.

- ✅ **Role-Based Access**  
  Admins, Estimators, and Viewers — each get a tailored view.

- ✅ **Interactive Dashboard**  
  Visualize emissions by material type, category, or project phase.

- ✅ **Downloadable Reports**  
  Export insights as PDF or CSV for client sharing or audits.

---

## 🔐 Secure & Simple Sign-In

- Sign in securely with **Google OAuth**
- Or, use organization credentials via **Replit Auth (Admin Only)**

---

## 🎯 Who Can Use SaHa?

- 🌇 Urban Planners  
- 🏗️ Construction Firms  
- 🧱 Architects & Civil Engineers  
- 🧑‍🏫 Students & Researchers  
- ♻️ Sustainability Officers  

---

## 📸 Screenshots / Demo Section *(Placeholders)*

- Dashboard View  
- Project Emission Breakdown  
- Add Materials Flow  
- Report Download Example  

---

## 📬 Stay in the Loop

_A new feature is launching soon: AI-powered material suggestions!_  
[Subscribe for Updates] or [Join the Beta Program]

---

## 📎 Footer

- About | Privacy Policy | Contact  
- Open-source initiative on GitHub (optional)  
- “© 2025 SaHa – Built for a low-carbon future.”

---

## 🔧 Google OAuth Setup (Dev Notes)

1. Go to **Supabase Project → Authentication → Providers**
2. Enable **Google**, enter your client ID & secret from Google Cloud Console
3. Adjust **redirect URLs** for dev (`localhost`) and prod (`vercel.app`)

### 🔐 Example Login Flow (Supabase Client)

```ts
const { data, error } = await supabase.auth.signInWithOAuth({
  provider: 'google',
});
```
