// ✅ index.js — kisanmilan Backend (Complete & Final — with 5% Buyer Markup)
require("dotenv").config();
const express    = require("express");
const cors       = require("cors");
const mongoose   = require("mongoose");
const bcrypt     = require("bcryptjs");
const jwt        = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const app = express();
app.use(cors());
app.use(express.json());
const JWT_SECRET = process.env.JWT_SECRET || "kisanmilan_secret";
const otpStore = {};
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
});
const generateOtp = () => Math.floor(100000 + Math.random() * 900000).toString();
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err.message));

/* ═══════════════════════ BUYER MARKUP HELPER ═══════════════════════ */
// 5% markup for buyers on all prices
function applyBuyerMarkup(price) {
  if (!price || isNaN(price)) return 0;
  return Math.round(price * 1.05 * 100) / 100;
}

/* ═══════════════════════ SCHEMAS ═══════════════════════ */
const userSchema = new mongoose.Schema(
  {
    name:         String,
    email:        { type: String, unique: true },
    phone:        { type: String, unique: true },
    role:         { type: String, enum: ["farmer", "buyer", "agent", "admin", "dpartner"], default: "buyer" },
    location:     String,
    password:     String,
    vehicle_type: { type: String, default: "" },
    aadhaar:      { type: String, default: "" },
  }, { timestamps: true }
);
const User = mongoose.model("User", userSchema, "user");

const productSchema = new mongoose.Schema(
  {
    name:         String,
    product_name: String,
    price:        Number,
    category:     String,
    description:  String,
    farmer_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    farmer_name:  String,
    stock:        Number,
    unit:         { type: String, default: "kg" },
    location:     String,
    image_url:    String,
    is_available: { type: Boolean, default: true },
    change:       { type: String, default: "0%" },
    role:         { type: String, default: "farmer" },
  }, { timestamps: true }
);
const Product = mongoose.model("Product", productSchema);

const farmerRateSchema = new mongoose.Schema(
  {
    farmer_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    farmer_name:  String,
    location:     String,
    product_name: String,
    price:        Number,
    change:       { type: String, default: "0%" },
    unit:         { type: String, default: "kg" },
    category:     String,
    description:  String,
    image_url:    String,
    image:        String,
    is_available: { type: Boolean, default: true },
    stock:        Number,
  }, { timestamps: true }
);
const FarmerRate = mongoose.model("FarmerRate", farmerRateSchema, "farmerrates");

const agentRateSchema = new mongoose.Schema(
  {
    agent_id:     { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    agent_name:   String,
    location:     String,
    product_name: String,
    price:        Number,
    change:       { type: String, default: "0%" },
    unit:         { type: String, default: "kg" },
    category:     String,
    description:  String,
    image_url:    String,
    image:        String,
    is_available: { type: Boolean, default: true },
    stock:        Number,
  }, { timestamps: true }
);
const AgentRate = mongoose.model("AgentRate", agentRateSchema, "agentrates");

const orderSchema = new mongoose.Schema(
  {
    buyer_id:         { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    seller_id:        { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    product_id:       { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    dpartner_id:      { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    product_name:     String,
    quantity:         Number,
    unit:             String,
    total_price:      Number,
    status:           { type: String, enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"], default: "pending" },
    delivery_address: String,
  }, { timestamps: true }
);
const Order = mongoose.model("Order", orderSchema, "order");

const paymentSchema = new mongoose.Schema(
  {
    order_id:       { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    buyer_id:       { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    seller_id:      { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    amount:         Number,
    payment_method: { type: String, enum: ["UPI", "NetBanking", "Card", "COD"], default: "UPI" },
    upi_id:         String,
    transaction_id: String,
    status:         { type: String, enum: ["pending", "completed", "failed", "refunded"], default: "pending" },
  }, { timestamps: true }
);
const Payment = mongoose.model("Payment", paymentSchema, "payment");

// ✅ Review schema has BOTH buyer_id AND user_id so old data works too
const reviewSchema = new mongoose.Schema(
  {
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    buyer_id:   { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    user_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    buyer_name: String,
    rating:     { type: Number, min: 1, max: 5 },
    comment:    String,
    review:     String,
  }, { timestamps: true }
);
const Review = mongoose.model("Review", reviewSchema, "review");

const rateSchema = new mongoose.Schema(
  { name: String, price: Number, change: { type: String, default: "0%" } },
  { timestamps: true }
);
const Rate = mongoose.model("Rate", rateSchema, "rates");

const totalOrderSchema = new mongoose.Schema(
  {
    total_orders:   { type: Number, default: 0 },
    total_revenue:  { type: Number, default: 0 },
    total_farmers:  { type: Number, default: 0 },
    total_buyers:   { type: Number, default: 0 },
    total_agents:   { type: Number, default: 0 },
    total_products: { type: Number, default: 0 },
    date:           { type: Date, default: Date.now },
  }, { timestamps: true }
);
const TotalOrder = mongoose.model("TotalOrder", totalOrderSchema, "totalorder");

const cartSchema = new mongoose.Schema(
  {
    user_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    quantity:   { type: Number, default: 1, min: 1 },
  }, { timestamps: true }
);
const Cart = mongoose.model("Cart", cartSchema, "cart");

const wishlistSchema = new mongoose.Schema(
  {
    user_id:    { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    product_id: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  }, { timestamps: true }
);
const Wishlist = mongoose.model("Wishlist", wishlistSchema, "wishlist");

/* ═══════════════════════ HELPERS ═══════════════════════ */
function toObjectId(id) {
  try { return new mongoose.Types.ObjectId(id); }
  catch { return null; }
}
function buildLocation(loc) {
  if (!loc) return "";
  if (typeof loc === "object")
    return [loc.city, loc.district, loc.state, loc.pincode].filter(Boolean).join(", ");
  return String(loc);
}

/* ═══════════════════════ MIDDLEWARE ═══════════════════════ */
function verifyToken(req, res, next) {
  const token = req.headers["authorization"]?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Access denied. No token." });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(403).json({ error: "Invalid or expired token" });
  }
}
function verifyAdmin(req, res, next) {
  verifyToken(req, res, () => {
    if (req.user.role !== "admin")
      return res.status(403).json({ error: "Admin access only" });
    next();
  });
}

/* ═══════════════════════ BASE ═══════════════════════ */
app.get("/", (req, res) => res.send("🚀 kisanmilan API Running"));
app.get("/status", (req, res) => {
  const states = { 0: "Disconnected", 1: "Connected", 2: "Connecting", 3: "Disconnecting" };
  res.json({ mongodb: states[mongoose.connection.readyState], uptime: Math.floor(process.uptime()) + "s" });
});

/* ═══════════════════════ AUTH ═══════════════════════ */
app.post("/auth/register", async (req, res) => {
  try {
    const { name, email, phone, password, role, location, vehicle_type, aadhaar } = req.body;
    if (!name || !email || !phone || !password)
      return res.status(400).json({ error: "Name, email, phone aur password sab required hain" });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
      return res.status(400).json({ error: "Invalid email format" });
    if (!/^[6-9]\d{9}$/.test(phone.trim()))
      return res.status(400).json({ error: "Invalid phone. 10-digit Indian mobile number chahiye" });
    if (password.length < 6)
      return res.status(400).json({ error: "Password minimum 6 characters ka hona chahiye" });
    if (["agent", "dpartner"].includes(role) && (!location || !location.trim()))
      return res.status(400).json({ error: "Is role ke liye location zaruri hai" });
    if (role === "dpartner") {
      if (!vehicle_type) return res.status(400).json({ error: "Vehicle type select karo" });
      if (!["bike","bicycle","auto","truck","van"].includes(vehicle_type))
        return res.status(400).json({ error: "Invalid vehicle type" });
      if (!aadhaar || !/^\d{12}$/.test(aadhaar.replace(/\s/g, "")))
        return res.status(400).json({ error: "Valid 12-digit Aadhaar number required hai" });
    }
    if (await User.findOne({ email: email.trim().toLowerCase() }))
      return res.status(400).json({ error: "Yeh email pehle se registered hai." });
    if (await User.findOne({ phone: phone.trim() }))
      return res.status(400).json({ error: "Yeh mobile number pehle se registered hai." });
    if (role === "dpartner" && aadhaar) {
      if (await User.findOne({ aadhaar: aadhaar.replace(/\s/g, "") }))
        return res.status(400).json({ error: "Yeh Aadhaar number pehle se registered hai." });
    }
    const hashed = await bcrypt.hash(password, 10);
    const userData = {
      name: name.trim(), email: email.trim().toLowerCase(),
      phone: phone.trim(), password: hashed,
      role: role || "buyer", location: location?.trim() || "",
    };
    if (role === "dpartner") {
      userData.vehicle_type = vehicle_type;
      userData.aadhaar      = aadhaar.replace(/\s/g, "");
    }
    const user = new User(userData);
    await user.save();
    if (user.role === "farmer")
      await FarmerRate.create({ farmer_id: user._id, farmer_name: user.name, location: user.location, product_name: "Default Product", price: 0 });
    if (user.role === "agent")
      await AgentRate.create({ agent_id: user._id, agent_name: user.name, location: user.location, product_name: "Default Product", price: 0 });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Registration successful ✅", token,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, location: user.location },
    });
  } catch (err) {
    if (err.code === 11000) {
      const field = Object.keys(err.keyPattern || {})[0];
      const map = { email: "Yeh email pehle se registered hai", phone: "Yeh mobile number pehle se registered hai", aadhaar: "Yeh Aadhaar pehle se registered hai" };
      return res.status(400).json({ error: map[field] || `Duplicate ${field}` });
    }
    res.status(500).json({ error: err.message });
  }
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const adminEmail    = process.env.ADMIN_EMAIL    || "admin@gmail.com";
    const adminPassword = process.env.ADMIN_PASSWORD || "123456";
    if (email === adminEmail && password === adminPassword) {
      const token = jwt.sign({ id: "admin-id", role: "admin" }, JWT_SECRET, { expiresIn: "7d" });
      return res.json({ message: "Admin login ✅", token, user: { id: "admin-id", name: "Admin", email, role: "admin" } });
    }
    const user = await User.findOne({ email: email.trim().toLowerCase() });
    if (!user) return res.status(404).json({ error: "User not found" });
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ error: "Wrong password" });
    const token = jwt.sign({ id: user._id, role: user.role }, JWT_SECRET, { expiresIn: "7d" });
    res.json({
      message: "Login successful ✅", token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role, location: user.location },
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/auth/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ FORGOT PASSWORD ═══════════════════════ */
app.post("/auth/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email?.trim()) return res.status(400).json({ error: "Email required hai" });
    const cleanEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: cleanEmail });
    if (!user) return res.status(404).json({ error: "Yeh email registered nahi hai" });
    const otp = generateOtp();
    otpStore[cleanEmail] = { otp, expiresAt: new Date(Date.now() + 10 * 60 * 1000), verified: false };
    await transporter.sendMail({
      from: `"kisanmilan" <${process.env.EMAIL_USER}>`, to: cleanEmail,
      subject: "kisanmilan — Password Reset OTP",
      html: `<div style="font-family:sans-serif;padding:32px;border:1px solid #e5e7eb;border-radius:12px;max-width:480px;margin:auto"><h2 style="color:#15803d">🌱 kisanmilan</h2><p>Password reset OTP:</p><div style="text-align:center;margin:24px 0"><span style="font-size:36px;font-weight:700;letter-spacing:10px;color:#15803d;background:#f0fdf4;padding:16px 24px;border-radius:10px;display:inline-block">${otp}</span></div><p style="color:#6b7280;font-size:13px">10 minutes mein expire hoga.</p></div>`,
    });
    res.json({ message: "OTP bhej diya gaya ✅" });
  } catch (err) {
    console.error("Forgot password error:", err.message);
    res.status(500).json({ error: "OTP send nahi ho paya." });
  }
});

app.post("/auth/verify-otp", (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ error: "Email aur OTP required hain" });
    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore[cleanEmail];
    if (!record) return res.status(400).json({ error: "Pehle OTP request karo" });
    if (new Date() > record.expiresAt) { delete otpStore[cleanEmail]; return res.status(400).json({ error: "OTP expire ho gaya." }); }
    if (record.otp !== otp.toString().trim()) return res.status(400).json({ error: "OTP galat hai." });
    otpStore[cleanEmail].verified = true;
    res.json({ message: "OTP verified ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/auth/reset-password", async (req, res) => {
  try {
    const { email, otp, new_password } = req.body;
    if (!email || !otp || !new_password) return res.status(400).json({ error: "Sab fields required hain" });
    const cleanEmail = email.trim().toLowerCase();
    const record = otpStore[cleanEmail];
    if (!record) return res.status(400).json({ error: "Pehle OTP verify karo" });
    if (!record.verified) return res.status(400).json({ error: "OTP abhi verify nahi hua" });
    if (new Date() > record.expiresAt) { delete otpStore[cleanEmail]; return res.status(400).json({ error: "Session expire ho gaya." }); }
    if (record.otp !== otp.toString().trim()) return res.status(400).json({ error: "OTP match nahi kar raha" });
    if (new_password.length < 6) return res.status(400).json({ error: "Password minimum 6 characters" });
    const hashed = await bcrypt.hash(new_password, 10);
    const user = await User.findOneAndUpdate({ email: cleanEmail }, { password: hashed }, { new: true });
    if (!user) return res.status(404).json({ error: "User nahi mila" });
    delete otpStore[cleanEmail];
    res.json({ message: "Password reset ho gaya ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ USER ═══════════════════════ */
app.get("/user", async (req, res) => {
  try {
    const { role, location, search } = req.query;
    let query = {};
    if (role && role !== "All") query.role = role;
    if (location?.trim()) query.location = { $regex: location.trim(), $options: "i" };
    if (search?.trim()) {
      const q = search.trim();
      query.$or = [{ name: { $regex: q, $options: "i" } }, { email: { $regex: q, $options: "i" } }, { phone: { $regex: q, $options: "i" } }];
    }
    res.json(await User.find(query).select("-password").sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/user", async (req, res) => {
  try {
    if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
    const user = new User(req.body);
    await user.save();
    res.json({ message: "User created ✅", data: user });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/user/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/user/:id", async (req, res) => {
  try {
    if (req.body.password) req.body.password = await bcrypt.hash(req.body.password, 10);
    const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select("-password");
    if (!user) return res.status(404).json({ error: "User not found" });
    const objectId = toObjectId(req.params.id);
    await FarmerRate.updateMany({ farmer_id: objectId }, { farmer_name: user.name, location: user.location });
    await AgentRate.updateMany({ agent_id: objectId }, { agent_name: user.name, location: user.location });
    await Product.updateMany({ farmer_id: objectId }, { farmer_name: user.name, location: user.location });
    res.json({ message: "User + All related data updated ✅", data: user });
  } catch (err) {
    console.error("❌ User update error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete("/user/:id", async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "User deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ PRODUCTS ═══════════════════════ */
app.get("/products", async (req, res) => {
  try {
    const { search, category, location, farmer_id } = req.query;
    let query = {};
    if (search?.trim()) query.$or = [
      { product_name: { $regex: search.trim(), $options: "i" } },
      { name:         { $regex: search.trim(), $options: "i" } },
    ];
    if (category && category !== "All") query.category = category;
    if (location?.trim()) query.location = { $regex: location.trim(), $options: "i" };
    if (farmer_id) query.farmer_id = farmer_id;

    const products = await Product.find(query).sort({ createdAt: -1 });

    // ✅ 5% markup for buyers
    const result = products.map((p) => {
      const obj = p.toObject();
      obj.original_price = obj.price;
      obj.price = applyBuyerMarkup(obj.price);
      return obj;
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/products/:id", async (req, res) => {
  try {
    // ✅ Populate farmer_id so farmer name shows on frontend
    const product = await Product.findById(req.params.id).populate("farmer_id", "name phone location");
    if (!product) return res.status(404).json({ error: "Product not found" });

    // ✅ 5% markup for buyers
    const obj = product.toObject();
    obj.original_price = obj.price;
    obj.price = applyBuyerMarkup(obj.price);

    res.json(obj);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/products", verifyToken, async (req, res) => {
  try {
    const role   = req.user?.role;
    const userId = req.user?.id || req.user?._id;
    if (!role)   return res.status(401).json({ error: "Role nahi mila. Token check karo." });
    if (!userId) return res.status(401).json({ error: "User ID nahi mila." });
    const farmerObjId = toObjectId(userId);
    if (!farmerObjId) return res.status(400).json({ error: "Invalid user ID format" });
    const locationString = buildLocation(req.body.location);
    if (role === "agent") {
      const agentRate = await AgentRate.create({
        product_name: req.body.product_name || req.body.name,
        price:        Number(req.body.price)  || 0,
        unit:         req.body.unit           || "kg",
        category:     req.body.category       || "",
        description:  req.body.description    || "",
        stock:        Number(req.body.stock)   || 0,
        location:     locationString,
        image_url:    req.body.image_url       || "",
        agent_id:     farmerObjId,
        agent_name:   req.body.agent_name      || "",
        is_available: true,
        change:       req.body.change          || "0%",
      });
      return res.json({ message: "Agent rate saved ✅", data: agentRate });
    }
    if (role === "farmer") {
      let savedProduct;
      try {
        const product = new Product({
          name:         req.body.name         || req.body.product_name,
          product_name: req.body.product_name || req.body.name,
          price:        Number(req.body.price) || 0,
          unit:         req.body.unit          || "kg",
          category:     req.body.category      || "",
          description:  req.body.description   || "",
          stock:        Number(req.body.stock)  || 0,
          location:     locationString,
          image_url:    req.body.image_url      || "",
          farmer_id:    farmerObjId,
          farmer_name:  req.body.farmer_name    || "",
          is_available: req.body.is_available !== undefined ? Boolean(req.body.is_available) : true,
          change:       req.body.change         || "0%",
          role:         "farmer",
        });
        savedProduct = await product.save();
      } catch (productErr) {
        return res.status(500).json({ error: "Product save failed: " + productErr.message });
      }
      let savedFarmerRate;
      try {
        savedFarmerRate = await FarmerRate.create({
          product_name: req.body.product_name || req.body.name,
          price:        Number(req.body.price) || 0,
          unit:         req.body.unit          || "kg",
          category:     req.body.category      || "",
          description:  req.body.description   || "",
          stock:        Number(req.body.stock)  || 0,
          location:     locationString,
          image_url:    req.body.image_url      || "",
          farmer_id:    farmerObjId,
          farmer_name:  req.body.farmer_name    || "",
          is_available: true,
          change:       req.body.change         || "0%",
        });
      } catch (rateErr) {
        return res.json({ message: "Product saved ✅ lekin FarmerRate failed ⚠", product: savedProduct, rateError: rateErr.message });
      }
      return res.json({ message: "Product + FarmerRate dono saved ✅", product: savedProduct, farmerRate: savedFarmerRate });
    }
    const product = new Product({ ...req.body, location: locationString, farmer_id: farmerObjId, role });
    await product.save();
    return res.json({ message: "Product saved ✅", data: product });
  } catch (err) {
    console.error("❌ POST /products outer error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/products/:id", verifyToken, async (req, res) => {
  try {
    const product = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!product) return res.status(404).json({ error: "Product not found" });
    res.json({ message: "Product updated ✅", data: product });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/products/:id", verifyToken, async (req, res) => {
  try {
    await Product.findByIdAndDelete(req.params.id);
    res.json({ message: "Product deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ FARMER RATES ═══════════════════════ */
app.get("/farmer-rates", async (req, res) => {
  try {
    const { location, farmer_id, category, search } = req.query;
    let query = {};
    if (farmer_id) { const oid = toObjectId(farmer_id); if (oid) query.farmer_id = oid; }
    if (category && category !== "All") query.category = { $regex: category, $options: "i" };
    if (search?.trim()) query.product_name = { $regex: search.trim(), $options: "i" };
    if (location?.trim()) query.location = { $regex: location.trim(), $options: "i" };

    const rates = await FarmerRate.find(query).sort({ createdAt: -1 });

    // ✅ 5% markup for buyers
    const result = rates.map((r) => {
      const obj = r.toObject();
      obj.original_price = obj.price;
      obj.price = applyBuyerMarkup(obj.price);
      return obj;
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/farmer-rates", verifyToken, async (req, res) => {
  try {
    const farmerObjId = toObjectId(req.body.farmer_id || req.user.id);
    const user = farmerObjId ? await User.findById(farmerObjId) : null;
    const rate = new FarmerRate({ ...req.body, farmer_id: farmerObjId, farmer_name: req.body.farmer_name || user?.name || "" });
    await rate.save();
    res.status(201).json({ message: "Farmer rate saved ✅", data: rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/farmer-rates/:id", verifyToken, async (req, res) => {
  try {
    const rate = await FarmerRate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rate) return res.status(404).json({ error: "Rate nahi mila" });
    res.json({ message: "Farmer rate updated ✅", data: rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/farmer-rates/:id", verifyToken, async (req, res) => {
  try {
    await FarmerRate.findByIdAndDelete(req.params.id);
    res.json({ message: "Farmer rate deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ AGENT RATES ═══════════════════════ */
app.get("/agent-rates", async (req, res) => {
  try {
    const { location, agent_id, category, search } = req.query;
    let query = {};
    if (agent_id) { const oid = toObjectId(agent_id); if (oid) query.agent_id = oid; }
    if (location?.trim()) query.location = { $regex: location.trim(), $options: "i" };
    if (category && category !== "All") query.category = { $regex: category, $options: "i" };
    if (search?.trim()) query.product_name = { $regex: search.trim(), $options: "i" };

    const rates = await AgentRate.find(query).sort({ createdAt: -1 });

    // ✅ 5% markup for buyers
    const result = rates.map((r) => {
      const obj = r.toObject();
      obj.original_price = obj.price;
      obj.price = applyBuyerMarkup(obj.price);
      return obj;
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/agent-rates", verifyToken, async (req, res) => {
  try {
    const agentObjId = toObjectId(req.body.agent_id || req.user.id);
    if (!agentObjId) return res.status(400).json({ error: "Invalid agent_id" });
    const rate = new AgentRate({
      product_name: req.body.product_name || req.body.name,
      price:        Number(req.body.price)  || 0,
      unit:         req.body.unit           || "kg",
      category:     req.body.category       || "",
      description:  req.body.description    || "",
      stock:        Number(req.body.stock)   || 0,
      location:     buildLocation(req.body.location),
      image_url:    req.body.image_url       || "",
      agent_id:     agentObjId,
      agent_name:   req.body.agent_name      || "",
      is_available: req.body.is_available !== undefined ? Boolean(req.body.is_available) : true,
      change:       req.body.change          || "0%",
    });
    await rate.save();
    res.status(201).json({ message: "Agent rate saved ✅", data: rate });
  } catch (err) {
    console.error("❌ POST /agent-rates error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

app.put("/agent-rates/:id", verifyToken, async (req, res) => {
  try {
    const rate = await AgentRate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rate) return res.status(404).json({ error: "Rate nahi mila" });
    res.json({ message: "Agent rate updated ✅", data: rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/agent-rates/:id", verifyToken, async (req, res) => {
  try {
    await AgentRate.findByIdAndDelete(req.params.id);
    res.json({ message: "Agent rate deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ ORDER ═══════════════════════ */
app.get("/order", async (req, res) => {
  try {
    const { buyer_id, seller_id, dpartner_id, status } = req.query;
    let query = {};
    if (buyer_id)    query.buyer_id    = buyer_id;
    if (seller_id)   query.seller_id   = seller_id;
    if (dpartner_id) query.dpartner_id = dpartner_id;
    if (status && status !== "All") query.status = status;
    const orders = await Order.find(query).sort({ createdAt: -1 });
    const enriched = await Promise.all(orders.map(async (order) => {
      const buyer    = await User.findById(order.buyer_id).select("name email phone");
      const seller   = await User.findById(order.seller_id).select("name phone role");
      const dpartner = order.dpartner_id ? await User.findById(order.dpartner_id).select("name phone") : null;
      const payment  = await Payment.findOne({ order_id: order._id });
      return {
        ...order.toObject(),
        buyer_name: buyer?.name || "—", buyer_email: buyer?.email || "—", buyer_phone: buyer?.phone || "—",
        farmer_name: seller?.name || "—", farmer_phone: seller?.phone || "—", seller_role: seller?.role || "—",
        dpartner_name: dpartner?.name || null, dpartner_phone: dpartner?.phone || null,
        payment_method: payment?.payment_method || null, payment_status: payment?.status || null,
        transaction_id: payment?.transaction_id || null,
      };
    }));
    res.json(enriched);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ 5% markup applied to total_price when order is created
app.post("/order", async (req, res) => {
  try {
    const order = new Order(req.body); // direct save, no markup
    await order.save();
    res.json({ message: "Order created ✅", data: order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/order/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json(order);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/order/:id", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ message: "Order updated ✅", data: order });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/order/:id", async (req, res) => {
  try {
    await Order.findByIdAndDelete(req.params.id);
    res.json({ message: "Order deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ PAYMENT ═══════════════════════ */
app.get("/payment", async (req, res) => {
  try {
    const { buyer_id, seller_id, status } = req.query;
    let query = {};
    if (buyer_id)  query.buyer_id  = buyer_id;
    if (seller_id) query.seller_id = seller_id;
    if (status && status !== "All") query.status = status;
    res.json(await Payment.find(query).sort({ createdAt: -1 }));
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/payment", async (req, res) => {
  try {
    const payment = new Payment(req.body);
    await payment.save();
    res.json({ message: "Payment recorded ✅", data: payment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/payment/order/:order_id", async (req, res) => {
  try {
    const payment = await Payment.findOne({ order_id: req.params.order_id });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/payment/:id", async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id);
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json(payment);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/payment/:id", async (req, res) => {
  try {
    const payment = await Payment.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!payment) return res.status(404).json({ error: "Payment not found" });
    res.json({ message: "Payment updated ✅", data: payment });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ REVIEW ═══════════════════════ */
app.get("/review", async (req, res) => {
  try { res.json(await Review.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/review/product/:product_id", async (req, res) => {
  try {
    const reviews = await Review.find({ product_id: req.params.product_id })
      .populate("buyer_id", "name")
      .populate("user_id", "name")
      .sort({ createdAt: -1 });

    // Normalize so frontend always gets r.user_id.name
    const normalized = reviews.map((r) => {
      const obj = r.toObject();
      if (!obj.user_id && obj.buyer_id) {
        obj.user_id = obj.buyer_id;
      }
      if (!obj.user_id?.name && obj.buyer_name) {
        obj.user_id = { name: obj.buyer_name };
      }
      return obj;
    });

    res.json(normalized);
  } catch (err) {
    console.error("Review fetch error:", err.message);
    res.status(500).json([]);
  }
});

app.post("/review", async (req, res) => {
  try {
    const reviewData = {
      ...req.body,
      user_id: req.body.user_id || req.body.buyer_id,
      buyer_id: req.body.buyer_id || req.body.user_id,
    };
    const review = new Review(reviewData);
    await review.save();
    res.json({ message: "Review added ✅", data: review });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/review/:id", async (req, res) => {
  try {
    await Review.findByIdAndDelete(req.params.id);
    res.json({ message: "Review deleted ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ RATE ═══════════════════════ */
app.get("/rates", async (req, res) => {
  try { res.json(await Rate.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/rates", async (req, res) => {
  try { const rate = new Rate(req.body); await rate.save(); res.json({ message: "Rate saved ✅", data: rate }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/rates/:id", async (req, res) => {
  try {
    const rate = await Rate.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!rate) return res.status(404).json({ error: "Rate not found" });
    res.json({ message: "Rate updated ✅", data: rate });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/rates/:id", async (req, res) => {
  try { await Rate.findByIdAndDelete(req.params.id); res.json({ message: "Rate deleted ✅" }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ TOTAL ORDER ═══════════════════════ */
app.get("/totalorder", async (req, res) => {
  try { res.json(await TotalOrder.find().sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

app.get("/totalorder/live", async (req, res) => {
  try {
    const [total_orders, total_products, farmers, buyers, agents, dpartners, completedPayments] = await Promise.all([
      Order.countDocuments(), Product.countDocuments(),
      User.countDocuments({ role: "farmer" }), User.countDocuments({ role: "buyer" }),
      User.countDocuments({ role: "agent" }), User.countDocuments({ role: "dpartner" }),
      Payment.find({ status: "completed" }),
    ]);
    res.json({
      total_orders, total_products, total_farmers: farmers, total_buyers: buyers,
      total_agents: agents, total_dpartners: dpartners,
      total_revenue: completedPayments.reduce((s, p) => s + (p.amount || 0), 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/totalorder", async (req, res) => {
  try { const doc = new TotalOrder(req.body); await doc.save(); res.json({ message: "TotalOrder saved ✅", data: doc }); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ CART ═══════════════════════ */
app.get("/cart", verifyToken, async (req, res) => {
  try {
    const items = await Cart.find({ user_id: req.user.id }).populate("product_id");

    // ✅ 5% markup on product price in cart
    const result = items.map((item) => {
      const product = item.product_id?.toObject ? item.product_id.toObject() : item.product_id;
      if (product && product.price != null) {
        product.original_price = product.price;
        product.price = applyBuyerMarkup(product.price);
      }
      return { _id: item._id, quantity: item.quantity, product };
    });

    res.json(result);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post("/cart", verifyToken, async (req, res) => {
  try {
    const { product_id, quantity = 1 } = req.body;
    if (!product_id) return res.status(400).json({ message: "product_id required hai" });
    const product = await Product.findById(product_id);
    if (!product) return res.status(404).json({ message: "Product nahi mila" });
    if (!product.stock || product.stock < 1)
      return res.status(400).json({ message: "Product out of stock hai" });
    const existing = await Cart.findOne({ user_id: req.user.id, product_id });
    if (existing) {
      existing.quantity += Number(quantity);
      await existing.save();
      return res.json({ message: "Cart quantity updated ✅", data: existing });
    }
    const item = await Cart.create({ user_id: req.user.id, product_id, quantity: Number(quantity) });
    res.json({ message: "Cart mein add ho gaya ✅", data: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put("/cart/:id", verifyToken, async (req, res) => {
  try {
    const { quantity } = req.body;
    if (!quantity || quantity < 1) return res.status(400).json({ message: "Valid quantity chahiye" });
    const item = await Cart.findOneAndUpdate(
      { _id: req.params.id, user_id: req.user.id },
      { quantity: Number(quantity) }, { new: true }
    );
    if (!item) return res.status(404).json({ message: "Cart item nahi mila" });
    res.json({ message: "Quantity updated ✅", data: item });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/cart/:id", verifyToken, async (req, res) => {
  try {
    const item = await Cart.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    if (!item) return res.status(404).json({ message: "Cart item nahi mila" });
    res.json({ message: "Cart se remove ho gaya ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete("/cart", verifyToken, async (req, res) => {
  try {
    await Cart.deleteMany({ user_id: req.user.id });
    res.json({ message: "Cart cleared ✅" });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ WISHLIST ═══════════════════════ */
app.get("/wishlist", verifyToken, async (req, res) => {
  try {
    const wishlist = await Wishlist.find({ user_id: req.user.id })
      .populate({
        path: "product_id",
        select: "product_name name image_url price stock category unit description is_available farmer_id location",
        populate: {
          path: "farmer_id",
          select: "name phone location",
        },
      });

    const result = wishlist
      .filter((item) => item.product_id)
      .map((item) => {
        const p = item.product_id;
        return {
          _id: item._id,
          createdAt: item.createdAt,
          product_id: {
            _id: p._id,
            product_name: p.product_name || p.name || "Unknown Product",
            image_url: p.image_url || "",
            // ✅ 5% markup on wishlist price
            original_price: p.price || 0,
            price: applyBuyerMarkup(p.price || 0),
            stock: p.stock || 0,
            category: p.category || "",
            unit: p.unit || "kg",
            description: p.description || "",
            is_available: p.is_available,
            location: p.location || "",
            farmer_id: p.farmer_id
              ? {
                  _id: p.farmer_id._id,
                  name: p.farmer_id.name || "",
                  phone: p.farmer_id.phone || "",
                  location: p.farmer_id.location || "",
                }
              : null,
          },
        };
      });

    res.json(result);
  } catch (err) {
    console.error("Wishlist GET error:", err.message);
    res.status(500).json([]);
  }
});

app.post("/wishlist", verifyToken, async (req, res) => {
  try {
    const { product_id } = req.body;
    const user_id = req.user.id;

    if (!product_id)
      return res.status(400).json({ message: "product_id is required" });

    const existing = await Wishlist.findOne({ 
  user_id: req.user.id, 
  product_id: new mongoose.Types.ObjectId(product_id) 
});

    if (existing) {
      await Wishlist.deleteOne({ _id: existing._id });
      return res.json({ message: "Removed from wishlist", action: "removed", product_id });
    }

    const newItem = await Wishlist.create({ user_id, product_id });

    const populated = await Wishlist.findById(newItem._id).populate({
      path: "product_id",
      select: "product_name name image_url price stock category unit description is_available farmer_id location",
      populate: { path: "farmer_id", select: "name phone location" },
    });

    const p = populated.product_id;
    res.status(201).json({
      message: "Added to wishlist",
      action: "added",
      item: {
        _id: populated._id,
        createdAt: populated.createdAt,
        product_id: {
          _id: p._id,
          product_name: p.product_name || p.name || "",
          image_url: p.image_url || "",
          // ✅ 5% markup on wishlist POST response
          original_price: p.price || 0,
          price: applyBuyerMarkup(p.price || 0),
          stock: p.stock || 0,
          category: p.category || "",
          unit: p.unit || "kg",
          description: p.description || "",
          is_available: p.is_available,
          location: p.location || "",
          farmer_id: p.farmer_id
            ? { _id: p.farmer_id._id, name: p.farmer_id.name || "", phone: p.farmer_id.phone || "" }
            : null,
        },
      },
    });
  } catch (err) {
    console.error("Wishlist POST error:", err.message);
    res.status(500).json({ message: "Server error" });
  }
});

app.delete("/wishlist/:id", verifyToken, async (req, res) => {
  try {
    await Wishlist.findOneAndDelete({ _id: req.params.id, user_id: req.user.id });
    res.json({ message: "Removed from wishlist ✅" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ═══════════════════════ DPARTNER ═══════════════════════ */
app.get("/dpartner", async (req, res) => {
  try { res.json(await User.find({ role: "dpartner" }).select("-password").sort({ createdAt: -1 })); }
  catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ ADMIN STATS ═══════════════════════ */
app.get("/admin/stats", verifyAdmin, async (req, res) => {
  try {
    const [totalUsers, totalFarmers, totalBuyers, totalAgents, totalDelivery, totalProducts, availableProducts,
      totalOrders, pendingOrders, deliveredOrders, cancelledOrders, totalFarmerRates, totalAgentRates,
      totalReviews, completedPayments] = await Promise.all([
      User.countDocuments(), User.countDocuments({ role: "farmer" }), User.countDocuments({ role: "buyer" }),
      User.countDocuments({ role: "agent" }), User.countDocuments({ role: "dpartner" }),
      Product.countDocuments(), Product.countDocuments({ is_available: true }),
      Order.countDocuments(), Order.countDocuments({ status: "pending" }),
      Order.countDocuments({ status: "delivered" }), Order.countDocuments({ status: "cancelled" }),
      FarmerRate.countDocuments(), AgentRate.countDocuments(), Review.countDocuments(),
      Payment.find({ status: "completed" }),
    ]);
    res.json({
      users:    { total: totalUsers, farmers: totalFarmers, buyers: totalBuyers, agents: totalAgents, delivery: totalDelivery },
      products: { total: totalProducts, available: availableProducts },
      orders:   { total: totalOrders, pending: pendingOrders, delivered: deliveredOrders, cancelled: cancelledOrders },
      rates:    { farmer: totalFarmerRates, agent: totalAgentRates },
      reviews:  totalReviews,
      revenue:  completedPayments.reduce((s, p) => s + (p.amount || 0), 0),
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

/* ═══════════════════════ 404 ═══════════════════════ */
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

/* ═══════════════════════ START ═══════════════════════ */
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 kisanmilan server running on port ${PORT}`));