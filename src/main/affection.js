const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

// Dipisah dari settings.js: ini bukan konfigurasi milik pengguna, tapi
// status/statistik pet yang berubah sendiri seiring waktu (like, jumlah pat).
function affectionFile() {
  return path.join(app.getPath('userData'), 'affection.json')
}

const defaultAffection = {
  likes: 0,
  patCount: 0,

  // Tanggal (YYYY-MM-DD) yang sedang dilacak, dan apakah sudah dipat sejak
  // tanggal itu dimulai. Dibandingkan ke tanggal sekarang tiap checkDaily().
  statDate: null,
  pattedToday: false,

  // Jumlah pat KHUSUS hari ini (beda dari patCount yang seumur hidup) --
  // dipakai widget counter mengambang, direset ke 0 tiap statDate berganti.
  patsToday: 0,
}

let cache = null

function today() {
  return new Date().toISOString().slice(0, 10)
}

function readAffection() {
  if (cache) {
    return cache
  }

  try {
    const raw = fs.readFileSync(affectionFile(), 'utf8').replace(/^﻿/, '')

    cache = { ...defaultAffection, ...JSON.parse(raw) }
  }
  catch {
    cache = { ...defaultAffection }
  }

  return cache
}

function writeAffection(patch) {
  cache = { ...readAffection(), ...patch }

  const file = affectionFile()

  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(cache, null, 2), 'utf8')

  return cache
}

// Dipanggil saat pet siap, lalu diulang berkala selama app jalan supaya
// pergantian hari tetap terdeteksi walau aplikasinya tidak pernah direstart.
// statDate yang masih null berarti instalasi baru -- tidak dihukum di hari
// pertama itu, cuma mulai dilacak dari sekarang.
function checkDaily() {
  const state = readAffection()
  const now = today()

  if (state.statDate === now) {
    return { ...state, penalized: false }
  }

  const penalized = Boolean(state.statDate) && !state.pattedToday

  const next = writeAffection({
    likes: penalized ? state.likes - 1 : state.likes,
    statDate: now,
    pattedToday: false,
    patsToday: 0,
  })

  return { ...next, penalized }
}

function recordPat() {
  const state = readAffection()
  const isNewDay = state.statDate !== today()

  return writeAffection({
    patCount: state.patCount + 1,
    patsToday: isNewDay ? 1 : state.patsToday + 1,
    pattedToday: true,
    statDate: today(),
  })
}

function getAffection() {
  return readAffection()
}

module.exports = {
  checkDaily,
  recordPat,
  getAffection,
}
