# Dataset Audit Report â€” Phase ML-1

**Dataset Location:** `C:\Users\hp\Desktop\Inspectra-main\Inspectra\ml\data\raw\casting_data`
**Audit Status:** PASSED (Ready for Phase ML-2 Splits)

---

## 1. Executive Summary

| Metric | Result |
| :--- | :--- |
| **Total Files Scanned** | 7348 |
| **Valid Usable Images** | 7348 |
| **Excluded / Invalid Files** | 0 |
| **Exact Duplicate Files** | 64 |
| **Class Imbalance Ratio** | 1.34:1 |

---

## 2. Class Distribution

| Class Label | Image Count | Percentage |
| :--- | :--- | :--- |
| `defective` | 4211 | 57.31% |
| `good` | 3137 | 42.69% |

---

## 3. Supported Extensions & File Formats

### File Extensions

| Extension | Count |
| :--- | :--- |
| `.jpeg` | 7348 |

### Detected Image Formats

| Image Format | Count |
| :--- | :--- |
| `JPEG` | 7348 |

---

## 4. Image Dimensions & Resolutions

- **Minimum Dimensions (WxH):** `300x300`
- **Maximum Dimensions (WxH):** `300x300`

| Resolution (WxH) | Image Count |
| :--- | :--- |
| `300x300` | 7348 |

---

## 5. Duplicate Image Analysis (SHA-256)

- **Total Redundant Duplicates Detected:** 64
- **Unique Duplicate Groups:** 64
- **Duplicate Groups Crossing Splits (Train âŸ· Test Leakage):** 64
- **Duplicate Groups Within Same Split:** 0

> [!CAUTION]
> **Data Leakage Alert:** 64 duplicate group(s) contain identical images spanning across separate splits (e.g. `train` and `test`).
> If the raw pre-split data is evaluated directly, test metrics will be artificially optimistic due to test-set leakage.
> In Phase ML-2, these duplicates must either be globally deduplicated or quarantined to the training split.

| Hash (SHA-256 Preview) | Splits Involved | Cross-Split Leakage? | Duplicate File Paths |
| :--- | :--- | :--- | :--- |
| `0387c085d3bd...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1180.jpeg`<br>`train\ok_front\cast_ok_0_1180.jpeg` |
| `05184fa78384...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1137.jpeg`<br>`train\ok_front\cast_ok_0_1137.jpeg` |
| `06113b5dd4b1...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1218.jpeg`<br>`train\ok_front\cast_ok_0_1218.jpeg` |
| `08ca14d5672e...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_903.jpeg`<br>`train\ok_front\cast_ok_0_903.jpeg` |
| `0b09411e68be...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1002.jpeg`<br>`train\ok_front\cast_ok_0_1002.jpeg` |
| `0d76eede562d...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1160.jpeg`<br>`train\ok_front\cast_ok_0_1160.jpeg` |
| `0e96c6bceb02...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1093.jpeg`<br>`train\ok_front\cast_ok_0_1093.jpeg` |
| `18e59809016a...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_907.jpeg`<br>`train\ok_front\cast_ok_0_907.jpeg` |
| `1b8762d083a1...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1077.jpeg`<br>`train\ok_front\cast_ok_0_1077.jpeg` |
| `1bbbf26b5d88...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1140.jpeg`<br>`train\ok_front\cast_ok_0_1140.jpeg` |
| `1ced12866e31...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_976.jpeg`<br>`train\ok_front\cast_ok_0_976.jpeg` |
| `1e283e4ad249...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_937.jpeg`<br>`train\ok_front\cast_ok_0_937.jpeg` |
| `2043ade87c9b...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_935.jpeg`<br>`train\ok_front\cast_ok_0_935.jpeg` |
| `263786c4fecc...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_932.jpeg`<br>`train\ok_front\cast_ok_0_932.jpeg` |
| `267c7f5f7f05...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1026.jpeg`<br>`train\ok_front\cast_ok_0_1026.jpeg` |
| `2aa702da90a5...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_975.jpeg`<br>`train\ok_front\cast_ok_0_975.jpeg` |
| `32dc9e03d1ac...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1202.jpeg`<br>`train\ok_front\cast_ok_0_1202.jpeg` |
| `38af148768db...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_904.jpeg`<br>`train\ok_front\cast_ok_0_904.jpeg` |
| `441e8baf1e2a...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_864.jpeg`<br>`train\ok_front\cast_ok_0_864.jpeg` |
| `4535375e3fb7...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1031.jpeg`<br>`train\ok_front\cast_ok_0_1031.jpeg` |
| `49e7e4b61fb0...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1022.jpeg`<br>`train\ok_front\cast_ok_0_1022.jpeg` |
| `4a9dcd17fd67...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1092.jpeg`<br>`train\ok_front\cast_ok_0_1092.jpeg` |
| `4d61ffb76c74...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1028.jpeg`<br>`train\ok_front\cast_ok_0_1028.jpeg` |
| `4e9e15eccf0d...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1209.jpeg`<br>`train\ok_front\cast_ok_0_1209.jpeg` |
| `53d1143e0d79...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1021.jpeg`<br>`train\ok_front\cast_ok_0_1021.jpeg` |
| `561a73b192aa...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_897.jpeg`<br>`train\ok_front\cast_ok_0_897.jpeg` |
| `59d638714461...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1203.jpeg`<br>`train\ok_front\cast_ok_0_1203.jpeg` |
| `59f121f75221...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_880.jpeg`<br>`train\ok_front\cast_ok_0_880.jpeg` |
| `5de95005e7d9...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1127.jpeg`<br>`train\ok_front\cast_ok_0_1127.jpeg` |
| `60c17a8690e7...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1095.jpeg`<br>`train\ok_front\cast_ok_0_1095.jpeg` |
| `6e1fd78c4804...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_952.jpeg`<br>`train\ok_front\cast_ok_0_952.jpeg` |
| `7528ab490555...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1210.jpeg`<br>`train\ok_front\cast_ok_0_1210.jpeg` |
| `76fc2186168b...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_863.jpeg`<br>`train\ok_front\cast_ok_0_863.jpeg` |
| `7ae675f3a71c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1173.jpeg`<br>`train\ok_front\cast_ok_0_1173.jpeg` |
| `804e2f01f722...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1132.jpeg`<br>`train\ok_front\cast_ok_0_1132.jpeg` |
| `8ece1c0bd51c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1169.jpeg`<br>`train\ok_front\cast_ok_0_1169.jpeg` |
| `8fb2a8f682cd...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1134.jpeg`<br>`train\ok_front\cast_ok_0_1134.jpeg` |
| `904a423323fe...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1003.jpeg`<br>`train\ok_front\cast_ok_0_1003.jpeg` |
| `91c4daff7a4e...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_973.jpeg`<br>`train\ok_front\cast_ok_0_973.jpeg` |
| `91d7d1d94402...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1001.jpeg`<br>`train\ok_front\cast_ok_0_1001.jpeg` |
| `a41803b7bc4c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_925.jpeg`<br>`train\ok_front\cast_ok_0_925.jpeg` |
| `aa117825460c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1019.jpeg`<br>`train\ok_front\cast_ok_0_1019.jpeg` |
| `aab5d02cfe92...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1066.jpeg`<br>`train\ok_front\cast_ok_0_1066.jpeg` |
| `acc76055b0e2...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1176.jpeg`<br>`train\ok_front\cast_ok_0_1176.jpeg` |
| `adff806a4f97...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_989.jpeg`<br>`train\ok_front\cast_ok_0_989.jpeg` |
| `b49db3cba6a4...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1040.jpeg`<br>`train\ok_front\cast_ok_0_1040.jpeg` |
| `beb55074f331...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_869.jpeg`<br>`train\ok_front\cast_ok_0_869.jpeg` |
| `c0174fb86288...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1172.jpeg`<br>`train\ok_front\cast_ok_0_1172.jpeg` |
| `c4e4be9481ad...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1096.jpeg`<br>`train\ok_front\cast_ok_0_1096.jpeg` |
| `c67b489294e5...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1213.jpeg`<br>`train\ok_front\cast_ok_0_1213.jpeg` |
| `c6ac4f1fc13a...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1171.jpeg`<br>`train\ok_front\cast_ok_0_1171.jpeg` |
| `c7481ff1006b...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1207.jpeg`<br>`train\ok_front\cast_ok_0_1207.jpeg` |
| `cb4c8388ba46...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1088.jpeg`<br>`train\ok_front\cast_ok_0_1088.jpeg` |
| `d031bedb5d62...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1020.jpeg`<br>`train\ok_front\cast_ok_0_1020.jpeg` |
| `d2007beb9d78...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_927.jpeg`<br>`train\ok_front\cast_ok_0_927.jpeg` |
| `d5ea1954519c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1121.jpeg`<br>`train\ok_front\cast_ok_0_1121.jpeg` |
| `dc497f70f03c...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_998.jpeg`<br>`train\ok_front\cast_ok_0_998.jpeg` |
| `de9be29f837b...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1165.jpeg`<br>`train\ok_front\cast_ok_0_1165.jpeg` |
| `e6d1aacd9295...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1120.jpeg`<br>`train\ok_front\cast_ok_0_1120.jpeg` |
| `e70ee4ab0376...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1069.jpeg`<br>`train\ok_front\cast_ok_0_1069.jpeg` |
| `e869529f5a4b...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_942.jpeg`<br>`train\ok_front\cast_ok_0_942.jpeg` |
| `eaae86958130...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_960.jpeg`<br>`train\ok_front\cast_ok_0_960.jpeg` |
| `f703675ab60d...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1200.jpeg`<br>`train\ok_front\cast_ok_0_1200.jpeg` |
| `fe19c5447142...` | `test`, `train` | **YES (LEAKAGE)** | `test\ok_front\cast_ok_0_1144.jpeg`<br>`train\ok_front\cast_ok_0_1144.jpeg` |

---

## 6. Exclusions & Discarded Files (Full Transparency)

- **Total Excluded:** 0

No files were excluded or discarded during scanning.

---

## 7. Recommendations for Phase ML-2 (Data Splitting)

1. **Leakage Prevention:** Group duplicate hashes and keep any augmented versions in the same split.
2. **Stratification:** Preserve class proportions (defective=57.31%, good=42.69%) across train, validation, and test manifests.
3. **Preprocessing:** Standardize image resizing to 224x224 RGB to match pretrained DINOv2 backbone requirements.
