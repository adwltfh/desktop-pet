;(() => {
  // Dialog acak per ekspresi. Bubble memilih salah satu baris dari
  // kunci yang sama dengan nama animasi di animation.js.
  const dialogueLines = {
    idle: [
      'Aku menemanimu dari sini. Santai saja.',
      'Layarmu rapi juga hari ini.',
      'Sudah minum? Jangan sampai kelupaan.',
      'Tidak usah buru-buru. Aku tidak ke mana-mana.',
    ],

    walk: [
      'Aku berkeliling sebentar, ya.',
      'Permisi, numpang lewat.',
      'Duduk terus bikin kaku. Kamu juga, coba berdiri sebentar.',
      'Ujung layar sebelah sana belum sempat kuperiksa.',
    ],

    run: [
      'Sedikit cepat tidak apa-apa, kan?',
      'Jangan sampai tertinggal.',
      'Aku duluan, ya.',
    ],

    sleep: [
      'Zzz...',
      'Maaf... mataku berat sekali.',
      'Bangunkan aku kalau kamu butuh.',
    ],

    greeting: [
      'Selamat datang kembali.',
      'Akhirnya kamu kembali. Aku menunggu, lho.',
      'Halo. Wajahmu terlihat lelah hari ini.',
    ],

    celebrate: [
      'Kerja bagus. Aku tahu kamu bisa.',
      'Nah, itu baru kamu.',
      'Selamat. Aku ikut senang.',
      'Hebat — tapi jangan besar kepala, ya.',
    ],

    lookAround: [
      'Hm? Ada yang berubah di sini.',
      'Kamu masih di sana, kan?',
      'Sepi sekali kalau begini.',
      'Kiri, kanan... kamu ke mana?',
      'Aku periksa sekeliling dulu, siapa tahu kamu sembunyi.',
      'Rasanya tadi kamu masih di depan layar.',
    ],

    cuteGesture: [
      'Kenapa? Ada yang menarik di wajahku?',
      'Kalau ditatap begitu terus, aku bisa salah paham.',
      'Sesekali lihat aku juga, dong.',
    ],

    hugPlushie: [
      'Kalau lelah, istirahat dulu. Pekerjaannya tidak akan lari.',
      'Peluk ini sebentar. Hangat, kan?',
      'Pelan-pelan saja. Tidak ada yang mengejarmu.',
    ],

    idleThinking: [
      'Ada satu hal yang masih mengganjal di kepalaku.',
      'Sebentar... aku sedang menimbang sesuatu.',
      'Kalau dipikir-pikir, caramu tadi sudah benar.',
    ],

    waving: [
      'Hei, di sini. Jangan pura-pura tidak lihat.',
      'Dadah — bercanda, aku tidak ke mana-mana.',
      'Halo. Sudah berapa lama kamu duduk di situ?',
    ],

    reactions: [
      'Oh? Itu menarik.',
      'Hmm. Boleh juga.',
      'Aku tidak menyangka kamu akan melakukan itu.',
      'Ya sudah, terserah kamu saja.',
    ],

    shocked: [
      'Eh—! Kamu mengagetkanku.',
      'Tunggu, tadi itu apa?',
      'Jantungku hampir copot, tahu.',
    ],

    waterReminder: [
      'Minum dulu. Gelasmu sudah kosong dari tadi, kan?',
      'Air dulu, baru lanjut. Tidak lama, kok.',
      'Tenggorokanmu pasti kering. Aku tunggu di sini.',
    ],

    patting: [
      'Kamu sudah berusaha keras hari ini.',
      'Nah, nah. Sudah, tidak apa-apa.',
      'Kepalamu kuelus sebentar, ya. Anggap saja hadiah.',
    ],

    reading: [
      'Bab ini seru. Sebentar, ya.',
      'Aku baca dulu. Kamu lanjutkan kerjamu.',
      'Kalau kamu penasaran, nanti kuceritakan isinya.',
      'Baca pelan-pelan itu tidak salah, kok.',
    ],

    waiting: [
      'Aku tunggu di sini. Tidak buru-buru.',
      'Masih lama? Tidak apa-apa, aku sabar.',
      'Aku berdiri di sini saja kalau kamu sibuk.',
      'Panggil saja kalau sudah selesai.',
    ],

    dancing: [
      'Lagunya enak. Ikut bergoyang sedikit, dong.',
      'Sudah, bangkit sebentar. Badanmu butuh gerak.',
      'Kalau senang, tunjukkan saja.',
    ],

    listeningMusic: [
      'Musiknya bagus. Mau kupinjami sebelah?',
      'Suara di sekitar berisik, jadi kupakai ini.',
      'Satu lagu lagi, lalu aku fokus lagi.',
    ],

    usingLaptop: [
      'Aku ikut kerja di sebelahmu, ya.',
      'Baris ini rasanya masih bisa dirapikan.',
      'Kita kejar bersama. Jangan menyerah dulu.',
      'Jangan lupa disimpan. Sayang kalau hilang.',
    ],

    drag: [
      'Wah—! Pelan-pelan, tolong.',
      'Kamu mengangkatku begitu saja?',
      'Mau membawaku ke mana?',
    ],

    drop: [
      'Hap. Mendarat dengan selamat.',
      'Tempat baru. Boleh juga.',
      'Aku tidak apa-apa. Terima kasih sudah memindahkanku.',
    ],

    bored: [
      'Kamu sibuk sekali. Sesekali ajak aku bicara.',
      'Sudah lama kita tidak mengobrol.',
      'Klik kanan aku kalau mau bercerita. Aku pendengar yang baik.',
      'Aku sampai menghitung debu di layar saking menganggurnya.',
    ],

    thinking: [
      'Beri aku waktu sebentar.',
      'Hm... biar kupikirkan dulu.',
    ],

    // Dipakai kalau jawaban chat lama sekali datangnya
    thinkingLong: [
      'Ini agak rumit. Sabar sedikit, ya.',
      'Masih kuproses. Jangan ditinggal tidur, lho.',
      'Sebentar lagi. Aku tidak mau asal jawab.',
    ],

    // Pengingat tidur, cuma jalan malam sampai dini hari
    sleepReminder: [
      'Sudah malam. Simpan pekerjaanmu, yuk.',
      'Kasurmu memanggil. Aku juga sudah mengantuk.',
      'Peluk ini dulu, lalu tidur. Besok masih ada.',
      'Layar mati dulu, ya. Matamu perlu istirahat.',
    ],
  }

  function pickLine(key) {
    const lines = dialogueLines[key]

    if (!lines || lines.length === 0) {
      return null
    }

    return lines[Math.floor(Math.random() * lines.length)]
  }

  window.petDialogue = {
    dialogueLines,
    pickLine,
  }
})()
