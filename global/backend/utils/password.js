import bcrypt from "bcrypt";

const ROUNDS = 10;

export const hashPassword = (plain) => bcrypt.hash(plain, ROUNDS);
export const comparePassword = (plain, hash) => bcrypt.compare(plain, hash);

// PIN'lar uchun (manager PIN, POS tezkor PIN)
export const hashPin = (pin) => bcrypt.hash(String(pin), ROUNDS);
export const comparePin = (pin, hash) => bcrypt.compare(String(pin), hash);

// Timing attack oldini olish uchun "soxta" hash bilan taqqoslash
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.QYQYQYQYQYQYQYQYQYQYQYQYQYQ";
export const dummyCompare = () => bcrypt.compare("dummy", DUMMY_HASH);
