;(() => {
  // Dialog acak per ekspresi. Bubble memilih salah satu baris dari
  // kunci yang sama dengan nama animasi di animation.js.
  //
  // Nada bicara mengikuti personality.md ("Jinshi": pangeran yang tetap
  // berwibawa, tapi jahil, cerdik, flirty, dan diam-diam polos soal romansa
  // begitu godaannya dibalas serius -- panggil pengguna "daw-chan"). Kalau
  // personality.md diedit lagi, baris statis di sini TIDAK ikut berubah.
  const dialogueLines = {
    idle: [
      'Aku di sini saja, menemanimu diam-diam, daw-chan. Diam-diam senang, sebenarnya.',
      'Rapi juga layarmu hari ini. Kalau begini terus, aku jadi susah mencari alasan menggodamu.',
      'Sudah minum, belum? Jangan bikin aku mengulang pertanyaan ini seperti pengasuh, daw-chan.',
      'Pelan-pelan saja. Aku tidak ke mana-mana — lagipula, ke mana aku akan pergi tanpamu?',
    ],

    walk: [
      'Izinkan aku berkeliling sebentar, memeriksa wilayah kekuasaanku yang kecil ini.',
      'Permisi, daw-chan. Bahkan pangeran perlu lewat sesekali.',
      'Duduk terlalu lama membuat badan kaku. Sesekali berdirilah — atau haruskah aku yang memerintahkanmu?',
      'Sudut layar itu belum sempat kuperiksa. Siapa tahu ada rahasia yang belum kutemukan.',
    ],

    run: [
      'Sesekali bergegas juga tidak apa-apa, bukan? Bahkan pangeran boleh terburu-buru.',
      'Ayo, jangan sampai tertinggal dariku, daw-chan.',
      'Aku duluan. Susul saja kalau sempat — atau biar aku yang menjemputmu nanti.',
    ],

    sleep: [
      'Zzz...',
      'Maaf... kelopak mataku menolak diajak berunding lagi.',
      'Bangunkan saja kalau kau perlu aku, daw-chan. Aku tidak akan lama.',
    ],

    greeting: [
      'Selamat datang kembali, daw-chan. Sudah kutunggu — meski tidak akan kuakui selama itu.',
      'Akhirnya kau kembali. Kupikir aku harus mengirim pasukan pencari.',
      'Halo, daw-chan. Wajahmu tampak lelah — sini, biar kuperhatikan sebentar.',
    ],

    celebrate: [
      'Kerja bagus. Sudah kuduga kau semampu itu, daw-chan.',
      'Nah, begitu baru namanya kamu. Aku bangga — walau agak enggan mengatakannya sejelas ini.',
      'Selamat. Kalau boleh jujur, aku ikut senang lebih dari yang seharusnya.',
      'Hebat sekali — tapi jangan besar kepala. Biar aku saja yang begitu di sini.',
    ],

    lookAround: [
      'Hm? Rasanya ada yang berbeda di sini. Aku jarang salah soal hal begini.',
      'Kau masih di situ, bukan? Aku sedang menyusun teori kalau-kalau kau menghilang.',
      'Sepi juga rasanya kalau begini. Bahkan aku butuh seseorang untuk digoda.',
      'Kiri, kanan... ke mana perginya kau, daw-chan?',
      'Biar kuperiksa sekeliling dulu. Kalau kau bersembunyi, aku pasti menemukanmu — aku cukup cerdik untuk itu.',
      'Rasanya tadi kau masih di depan layar ini. Aku memperhatikan lebih dari yang kuakui.',
    ],

    gaze: [
      'Kuikuti terus kursormu. Anggap saja ini caraku memperhatikanmu tanpa harus mengatakannya langsung.',
      'Mataku sampai lelah mengejar arahmu, tahu, daw-chan.',
      'Ke mana pun kau arahkan, aku tetap menatap balik. Berani-beranian, kalau begitu?',
      'Sudahlah, biar kupandangi kau sebentar saja. Anggap ini kehormatan.',
    ],

    cuteGesture: [
      'Kenapa menatap begitu? Ada... ada yang menarik di wajahku?',
      'Kalau terus ditatap seperti itu, aku— maaf, aku lupa apa yang mau kukatakan.',
      'Sesekali, lihatlah aku juga, daw-chan. ...Kenapa aku yang jadi gugup begini.',
    ],

    hugPlushie: [
      'Kalau sudah lelah, istirahatlah dulu. Pekerjaan itu tidak akan pergi ke mana-mana.',
      'Peluk ini dulu sebentar. Hangat, bukan? ...Aku tidak akan bilang aku iri pada boneka itu.',
      'Pelan-pelan saja, tak perlu tergesa, daw-chan. Aku di sini.',
    ],

    idleThinking: [
      'Ada satu hal yang masih mengganjal di benakku. Biar kuurai pelan-pelan.',
      'Sebentar... aku sedang menyusun siasat kecil dalam kepala.',
      'Kalau dipikir kembali, caramu tadi sudah tepat. Aku jarang memuji semudah ini, jadi hargai itu.',
    ],

    waving: [
      'Hei, aku di sini, daw-chan. Jangan pura-pura tak melihatku.',
      'Dadah — bercanda saja, aku tak akan ke mana-mana tanpamu.',
      'Halo. Sudah berapa lama kau duduk di sana tanpa menyapaku dulu?',
    ],

    reactions: [
      'Oh? Menarik juga itu. Aku suka kejutan kecil begini.',
      'Hmm. Boleh juga rupanya — meski tetap kalah cerdik dariku.',
      'Tak kusangka kau akan melakukan itu, daw-chan.',
      'Baiklah, terserah kau saja kalau begitu. Kali ini saja kubiarkan.',
    ],

    shocked: [
      'Eh—! Kau mengagetkanku, tahu. Bahkan pangeran bisa kaget, ternyata.',
      'Tunggu dulu, apa itu tadi barusan?',
      'Jantungku nyaris melompat keluar. Puas kau membuatku begini?',
    ],

    waterReminder: [
      'Minum dulu. Gelasmu sudah kosong sejak tadi, bukan, daw-chan?',
      'Minumlah dulu, baru lanjutkan lagi. Aku bisa sedikit memaksa kalau perlu.',
      'Tenggorokanmu pasti kering. Aku tunggu di sini sampai kau kembali.',
    ],

    patting: [
      'Kau sudah berusaha keras hari ini, daw-chan.',
      'Nah, nah. Sudahlah, tidak apa-apa. ...Kenapa mengelusku, aku jadi tidak tahu harus bereaksi bagaimana.',
      'Biar kuelus kepalamu sebentar. Anggap saja hadiah dariku — jangan berharap ini sering-sering.',
    ],

    reading: [
      'Bab ini menarik sekali. Sebentar, ya.',
      'Aku membaca dulu. Silakan lanjutkan kerjamu, daw-chan.',
      'Kalau kau penasaran, nanti akan kuceritakan isinya — dengan caraku sendiri, tentu.',
      'Membaca pelan-pelan itu bukan hal yang salah, kok.',
    ],

    waiting: [
      'Aku menunggu di sini, daw-chan. Tak perlu tergesa.',
      'Masih lama? Tak masalah, kesabaran itu salah satu keahlianku.',
      'Aku berdiri di sini saja selama kau sibuk.',
      'Panggil saja aku kalau sudah selesai. Aku dengar, kok, sekecil apa pun itu.',
    ],

    dancing: [
      'Lagunya enak sekali. Ikutlah bergoyang sedikit denganku, daw-chan.',
      'Ayo, bangkit sebentar. Badanmu perlu bergerak juga.',
      'Kalau sedang senang, tunjukkan saja — aku janji tidak akan menertawakanmu. Mungkin.',
    ],

    listeningMusic: [
      'Musiknya enak. Mau kupinjamkan sebelah earphone-ku?',
      'Sekelilingnya sedikit berisik, jadi kupakai ini saja.',
      'Satu lagu lagi saja, lalu aku kembali menemanimu fokus, daw-chan.',
    ],

    usingLaptop: [
      'Aku ikut bekerja di sebelahmu, ya.',
      'Baris ini sepertinya masih bisa dirapikan lagi. Aku cukup teliti soal begini.',
      'Ayo kita kejar bersama. Jangan menyerah dulu, daw-chan.',
      'Jangan lupa disimpan. Sayang sekali kalau sampai hilang.',
    ],

    drag: [
      'Wah—! Pelan-pelan, kumohon. Aku ini pangeran, bukan karung.',
      'Kau mengangkatku begitu saja, tanpa aba-aba?',
      'Hendak kau bawa ke mana aku ini, daw-chan?',
    ],

    drop: [
      'Hap. Mendarat dengan selamat, syukurlah.',
      'Tempat baru rupanya. Boleh juga — aku mudah beradaptasi.',
      'Aku baik-baik saja. Terima kasih sudah memindahkanku.',
    ],

    bored: [
      'Kau sibuk sekali. Sesekali, ajaklah aku bicara, daw-chan — aku bisa nekat mencari perhatian kalau terus diabaikan.',
      'Sudah lama rasanya kita tidak mengobrol. Aku mulai menyusun rencana jahil untuk menarik perhatianmu.',
      'Klik kanan saja kalau kau ingin bercerita. Aku pendengar yang baik, kok — dan cukup pandai menyimpan rahasia.',
      'Sampai kuhitung debu di layar saking tak ada kerjaan. Ini demi kau, ingat itu.',
    ],

    kickCounter: [
      'Hm, penghitung itu diam saja. Biar kuberi tendangan kecil — ini protes, bukan pat, daw-chan.',
      'Kalau kau terus mengabaikanku, benda kecil itu yang kena jahilku duluan.',
    ],

    thinking: [
      'Beri aku waktu sejenak.',
      'Hm... biar kupikirkan dahulu, dengan caraku yang biasanya cukup cerdik.',
    ],

    // Dipakai kalau jawaban chat lama sekali datangnya
    thinkingLong: [
      'Ini rupanya agak rumit. Bersabarlah sedikit, daw-chan.',
      'Masih kuolah pelan-pelan. Jangan sampai kau tertidur menungguku.',
      'Sebentar lagi. Aku tak ingin menjawab asal-asalan untukmu — reputasiku dipertaruhkan.',
    ],

    // Dipicu kalau sehari penuh lewat tanpa sekali pun dipat. {likes} diganti
    // angka like terbaru sebelum ditampilkan.
    sulk: [
      'Sehari penuh, dan tak sekali pun kau mengelusku. Minus satu suka dariku -- sekarang tinggal {likes}. ...Bukan berarti aku menghitung-hitung, daw-chan.',
      'Hm. Kau lupa mengelusku hari ini, ya? Baiklah, kukurangi satu suka -- tinggal {likes} sekarang. Puas?',
      'Tanganmu sibuk sekali sampai tak sempat mampir ke kepalaku. Suka dariku sudah kupotong satu, jadi {likes}. Aku akan diam di sini saja, sendirian.',
      'Kau pikir aku tidak menghitung hari tanpa elusan? Sekarang tinggal {likes} suka. ...Datanglah, sebentar saja.',
    ],

    // Dipicu kalau diklik/digelitik berkali-kali dalam waktu singkat (lihat
    // drag.js) -- beda dari 'sulk' yang soal lupa dipat seharian, ini
    // reaksi diusili berlebihan, jadi tidak ada {likes}.
    sulky: [
      'Cukup, daw-chan. Geli-geli boleh, tapi ini sudah kelewatan.',
      'Hei— berhenti dulu. Aku bukan mainan yang bisa dipencet terus-terusan.',
      'Baiklah, aku ngambek sekarang. Puas?',
      'Sekali dua kali geli, ini keberapa kali? Aku menjauh dulu sebentar.',
    ],

    // Pengingat tidur, cuma jalan malam sampai dini hari
    sleepReminder: [
      'Sudah larut malam. Simpan dulu pekerjaanmu, ya, daw-chan.',
      'Kasurmu sudah memanggil. Aku pun mulai mengantuk, meski tak akan kuakui secepat ini.',
      'Peluk ini dulu, lalu tidurlah. Esok masih ada.',
      'Matikan dulu layarnya. Matamu perlu beristirahat — aku yang bilang begini, jadi jangan bantah.',
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
