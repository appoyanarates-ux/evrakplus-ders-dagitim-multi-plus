# EvrakPlus Ders Dağıtım — Performans Raporu (v1.0.0 — Sert Kısıtlı & Gerçek OS Bellek Ölçümlü)

Bu rapordaki tüm ölçümler **gerçek Google OR-Tools CP-SAT (`9.14.6206`)** ve bağımsız doğrulayıcı (`solver/validate_result.py`) ile Windows 10 x64 ortamında canlı çalıştırılarak elde edilmiştir (`scripts/run_perf_benchmarks.py` → `docs/perf_benchmark_results.json`).

## Bellek ve Boyut Birimlerinin Açık Tanımı
- **Model JSON (KB):** Çözücüye iletilen tam okul modeli JSON dosya büyüklüğü.
- **Python Heap Pik (MB):** `tracemalloc` ile ölçülen yalnızca Python yorumlayıcısı yığın (heap) pik belleği (C++ OR-Tools kütüphane belleğini içermez).
- **Gerçek OS Süreç Pik RAM / RSS (MB):** Windows `psapi.dll → GetProcessMemoryInfo (PeakWorkingSetSize)` ile ölçülen Python + C++ Google OR-Tools CP-SAT toplam gerçek fiziksel bellek kullanımı.

## 1. Sert Kısıtlı 4 Okul Profili (Tüm Bloklar + Kilitler + Engelli Öğretmen + Özel Derslik)

| Senaryo Profili | Öğrt / Şube | Blok (Yerleşen) | Kilitli Blok (Korundu mu?) | Engelli Öğrt / Özel Derslik | Model JSON | Yükleme | OR-Tools Süresi | Durum | Bağımsız Doğrulama | Python Heap Pik | OS Peak RSS (Gerçek RAM) |
|---|---:|---:|---|---:|---:|---:|---:|---|---|---:|---:|
| Küçük Okul | 10 / 5 | 105 / 105 | 5 (`true`) | 3 / 2 | 25.0 KB | 1.76 ms | 22.37 s | `FEASIBLE` | **Geçti** | 3.29 MB | **158.47 MB** |
| Orta Okul | 30 / 15 | 315 / 315 | 14 (`true`) | 8 / 4 | 72.5 KB | 4.22 ms | 41.43 s | `FEASIBLE` | **Geçti** | 9.36 MB | — |
| Büyük Okul | 70 / 30 | 630 / 630 | 20 (`true`) | 18 / 6 | 145.4 KB | 14.17 ms | 69.34 s | `FEASIBLE` | **Geçti** | 19.94 MB | — |
| Çok Büyük Okul | 120 / 50 | 1050 / 1050 | 20 (`true`) | 30 / 8 | 241.0 KB | 65.33 ms | 114.91 s | `FEASIBLE` | **Geçti** | 34.17 MB | **285.41 MB** |
| Çözülemez Senaryo | 10 / 5 | 0 / 105 | 5 (`false`) | 3 / 2 | 26.1 KB | 2.08 ms | 0.19 s | `INFEASIBLE` | Doğru reddedildi | 0.04 MB | — |
| Zaman Sınırı (1 sn) | 120 / 50 | 0 / 1050 | 20 (`false`) | 30 / 8 | 241.0 KB | 63.47 ms | 32.29 s* | `UNKNOWN` | Doğru reddedildi | 34.30 MB | — |

*\*Zaman sınırı senaryosunda model inşa + 1 sn arama toplamı 32.29 s sürmüş; yarım/geçersiz çözüm üretilmeden `UNKNOWN` dönülmüştür.*

## 2. Kurulum Paketi Boyutları (Disk Büyüklüğü)
- `EvrakPlus-Ders-Dagitim-Setup-1.0.0.exe`: **123.53 MB** (`129,527,850` bayt — sıkıştırılmış NSIS kurulum dosyası)
- `EvrakPlus-Ders-Dagitim-Source-1.0.0.zip`: **~0.76 MB** (yalnızca temiz kaynak kodu, `node_modules`/`.venv` hariç)
- `evrakplus-ders-dagitim-bridge-1.0.0.zip`: **20.0 KB** (`20,508` bayt — POSIX `/` yol yapılı WordPress eklentisi)
