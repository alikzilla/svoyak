#!/usr/bin/env bash
# Скачивает на вашем компьютере то, что облачный сервер получить не может:
# автосубтитры выпусков СВОЯКа (YouTube блокирует облачные IP) и картинки
# для пака #7 (Wikimedia ограничивает облачные IP). Потом отправляет их в ветку.
# Запуск из корня репозитория: bash scripts/fetch-koval-sources.sh
# Нужны: yt-dlp (brew install yt-dlp) и Chrome, где вы вошли в YouTube (выпуски 18+).
set -u
cd "$(dirname "$0")/.."
mkdir -p subs/img

echo "== Субтитры"
yt-dlp --write-auto-subs --sub-langs ru --skip-download --cookies-from-browser "${BROWSER_NAME:-chrome}" \
  --sleep-requests 2 -o "subs/%(id)s.%(ext)s" \
  S_RgvOA7CpE 1kPm1gRez24 kiusnXwLDtU tXEM3FSfsWc 5RK0YnF2U6s yRJtjOKCgRE || echo "!! yt-dlp завершился с ошибкой — пришлите её текст"

echo "== Картинки для пака #7"
get() { curl -sfL -A "svoyak-pack-builder/1.0" -o "subs/img/$1" "https://commons.wikimedia.org/wiki/Special:FilePath/$2?width=1000" && echo "ok  $1" || echo "!!  $1"; sleep 1; }
get "File_Bat_cricket__jpg.jpg" "Bat%28cricket%29.jpg"
get "File_Shagai_2x2_jpg.jpg" "Shagai_2x2.jpg"
get "Taj_Mahal.jpg" "Taj_Mahal_%28Edited%29.jpeg"
get "Machu_Picchu.jpg" "Machu_Picchu%2C_2023_%28012%29.jpg"
get "Petra.jpg" "Al_Deir_Petra.JPG"
get "Chichen_Itza.jpg" "Chichen_Itza_3.jpg"
get "Angkor_Wat.jpg" "Angkor_Wat.jpg"
get "Doge__meme_.jpg" "Doge_meme_example.jpg"
get "Capybara.jpg" "Capybaracropped.jpg"
get "Lake_Baikal.jpg" "Baikal.A2001296.0420.250m-NASA.jpg"
get "Burj_Khalifa.jpg" "Burj_Khalifa_%28worlds_tallest_building%29_and_the_Dubai_skyline_%2825781049892%29.jpg"
get "File_Kazakh_Baursak_jpg.jpg" "Kazakh_Baursak.jpg"
get "File_Бешбармак___казахское_национальное_блюдо_jpg.jpg" "%D0%91%D0%B5%D1%88%D0%B1%D0%B0%D1%80%D0%BC%D0%B0%D0%BA_-_%D0%BA%D0%B0%D0%B7%D0%B0%D1%85%D1%81%D0%BA%D0%BE%D0%B5_%D0%BD%D0%B0%D1%86%D0%B8%D0%BE%D0%BD%D0%B0%D0%BB%D1%8C%D0%BD%D0%BE%D0%B5_%D0%B1%D0%BB%D1%8E%D0%B4%D0%BE.jpg"
get "File_Kazakh_quwyrdaq_jpg.jpg" "Kazakh_quwyrdaq.jpg"
get "File_Horsemeat_platter_jpg.jpg" "Horsemeat_platter.jpg"
get "File_Shubat_jpg.jpg" "Shubat.jpg"
get "Plains_zebra.jpg" "Equus_quagga_burchellii_-_Etosha%2C_2014.jpg"
get "Giraffe.jpg" "Giraffe_Mikumi_National_Park.jpg"
get "Indian_peafowl.jpg" "Peacock_on_tree_%2852077240794%29.jpg"
get "Veiled_chameleon.jpg" "Yemen_Chameleon.jpg"
get "Indian_crested_porcupine.jpg" "Weissschwanzstachelschwein_Hystrix_indica_Tierpark_Hellabrunn-12_%28cropped%29.jpg"
get "Saturn.jpg" "Saturn_global_view_from_Cassini%2C_rings_open_Better_Colour.png"
get "Jupiter.jpg" "Jupiter_OPAL_2024.png"
get "International_Space_Station.jpg" "The_station_pictured_from_the_SpaceX_Crew_Dragon_5.jpg"
get "File_Black_hole___Messier_87_crop_max_res_jpg.jpg" "Black_hole_-_Messier_87_crop_max_res.jpg"
get "Baikonur_Cosmodrome.jpg" "Baikonur_Cosmodrome_Soyuz_launch_pad.jpg"

echo "== Отправка"
git add subs
git commit -m "субтитры выпусков и картинки для пака #7" && git push
ls subs
