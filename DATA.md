# Data

The MIT license in [LICENSE](LICENSE) covers this repository's code and documentation. It does not cover the datasets or logo listed here.

## Datasets

| Dataset | File | Contents |
| :--- | :--- | :--- |
| Perspectiva workshop diagrams | `apps/perspectiva/data/datasets.json` | Causal loop diagrams from 8 workshop participants, each with a first and a final version |
| ACCESS causal graph sample | `apps/explorer/public/dataset.json` | 100 of the 725 abstract events, the 295 causal links between them, and up to five event descriptions each |

### Perspectiva workshop diagrams

Each diagram holds the participant's terms, standardised terms, causal links, link polarity, and annotations made during verification. Participants are identified only by type and number, such as `citizen_1`. The file contains no names or free-text comments.

These diagrams were used in the work behind Perspectiva, published as:

> Jessica Bou Nassar, Yu Xuan Yio, Nethara Athukorala, Simran, Songhai Fan, Cynthia Huang, Lyn Bartram, Tim Dwyer and Sarah Goodwin. Out of the Loop: Enhancing Documentation and Transparency in Causal Loop Diagrams to Capture Multiple Perspectives. IEEE VIS 2025.

[TO CONFIRM: the workshop study, its dates and location, and the ethics approval reference.]

You can view this data and run this project with it. No other rights are granted, so ask before reusing or redistributing it.

[TO CONFIRM: replace the line above if this data will have an open license.]

### ACCESS causal graph sample

This is a sample of the most central events in the ACCESS benchmark. Generalised event descriptions from GLUCOSE were clustered into abstract events, and annotators judged the causal links between them.

> Vy Vo, Lizhen Qu, Tao Feng, Yuncheng Hua, Xiaoxi Kang, Songhai Fan, Tim Dwyer, Lay-Ki Soon and Gholamreza Haffari. ACCESS: A Benchmark for Abstract Causal Event Discovery and Reasoning. NAACL 2025. [arXiv:2502.08148](https://arxiv.org/abs/2502.08148)

GLUCOSE is released under the [Creative Commons Attribution-NonCommercial 4.0 International license](https://github.com/ElementalCognition/glucose), so this data is limited to non-commercial use, and any use must credit GLUCOSE:

> Nasrin Mostafazadeh et al. GLUCOSE: GeneraLized and COntextualized Story Explanations. EMNLP 2020. [arXiv:2009.07758](https://arxiv.org/abs/2009.07758)

The full benchmark isn't published here. It's [available on request](https://github.com/isVy08/ACCESS) from the ACCESS authors.

## Logo

The Monash University logo in `apps/explorer/public/monash.png` belongs to Monash University, and neither the MIT license nor this notice grants any rights to it.

## Contact

Songhai Fan, songhai.fan@monash.edu
