import jwt from "jsonwebtoken";
import { v4 as uuidv4 } from "uuid";
import config from "../config/index.js";

/**
 * Token strategiyasi — obsidian/02-arxitektura/xavfsizlik/auth-strategiyasi.md
 *
 * 4 token turi:
 *  - user     : filial xodimi (waiter/cook/cashier/branch_admin)
 *  - owner    : restoran egasi
 *  - refresh  : userToken yangilash uchun
 *  - branch   : lokal backend ↔ global ulanish (alohida BRANCH_SECRET)
 */

// ===== Sign =====
export function signUserToken(user) {
  return jwt.sign(
    {
      type: "user",
      userId: user._id.toString(),
      restaurantId: user.restaurantId.toString(),
      branchId: user.branch.toString(),
      role: user.role,
      tokenVersion: user.tokenVersion ?? 1,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.userTokenTtl },
  );
}

export function signSystemToken(admin) {
  return jwt.sign(
    {
      type: "system",
      userId: admin._id.toString(),
      role: "system_admin",
      tokenVersion: admin.tokenVersion ?? 1,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.userTokenTtl },
  );
}

export function signOwnerToken(restaurant) {
  return jwt.sign(
    {
      type: "owner",
      restaurantId: restaurant._id.toString(),
      role: "owner",
      tokenVersion: restaurant.tokenVersion ?? 1,
    },
    config.jwt.secret,
    { expiresIn: config.jwt.userTokenTtl },
  );
}

export function signRefreshToken(subject) {
  // subject: { kind: 'user'|'restaurant', id, tokenVersion }
  return jwt.sign(
    {
      type: "refresh",
      subjectKind: subject.kind,
      subjectId: subject.id.toString(),
      tokenVersion: subject.tokenVersion ?? 1,
      jti: uuidv4(),
    },
    config.jwt.secret,
    { expiresIn: config.jwt.refreshTtl },
  );
}

export function signBranchToken(branch) {
  return jwt.sign(
    {
      type: "branch",
      branchId: branch._id.toString(),
      restaurantId: branch.restaurant.toString(),
      issuedFor: "local-backend",
    },
    config.jwt.branchSecret,
    { expiresIn: config.jwt.branchTtl },
  );
}

// ===== Verify =====
export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

export function verifyBranchToken(token) {
  return jwt.verify(token, config.jwt.branchSecret);
}

// Authorization header'dan token ajratish
export function extractBearer(req) {
  const header = req.headers.authorization;
  if (!header) return null;
  const parts = header.split(" ");
  return parts.length === 2 && parts[0] === "Bearer" ? parts[1] : parts[0];
}

// Eski kod bilan moslik uchun (deprecated — signUserToken ishlating)
export default signUserToken;
