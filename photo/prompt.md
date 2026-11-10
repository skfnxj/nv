# `photo` — 디바이스 사진 메시지 (각별함 단계)

홈페이지 디바이스 대화에서 호감이 **각별함(85)**이 되면 캐릭터가 보내 주는 사진 한 장이에요.

- 파일 이름: `<캐릭터>.webp` (예: `ruan.webp`). 이 폴더에 넣으면 돼요.
- 파일이 없으면 홈페이지는 사진을 보내지 않고 기다려요. 나중에 올리면 그때 와요.
- 휴대폰으로 찍은 느낌이라 세로 3:4를 권장해요(예: 832×1104). 대화창에서는 폭 240px으로 줄여서 보여요.
- 조합: **그림체 고정**(`../../프롬프트_그림체고정.txt`의 [품질]·[작가]·[조명]·[기법]·[인체]) + 아래 장면.
- 안지만 셀카라서 캐릭터 기본(`../char/anzi_prompt.md`)을 붙여요. 나머지는 인물 없는 사물·풍경 사진이에요.

| 캐릭터 | 사진 | 보내며 하는 말 |
|---|---|---|
| 루안 | 바이크 위에서 본 새벽 사막 도로 | 새벽에 달리다 찍었다. / ……다음엔 뒤에 타. |
| 제니스 | 책상 위 빈 편지지와 만년필 | 책상 정리하다가요. / ……아직 한 줄도 못 썼어요. |
| 레이너 | 비 오는 뉴올리언스 작은 집 현관 | 뉴올리언스 이웃이 보내 줬어요. / 문 앞 화분, 아직 살아 있대요. |
| 안지 | 크로니클 옥상 테라스 셀카 | 1면 사진 아님. 그냥 찍었어. / 흠. 저장해 둬도 돼. |
| 미노스 | 새벽 다이너 부스, 커피 두 잔 | 끝났다. 다이너. / ……네 자리 비어 있다. |
| 진 | 레지던스 서재 턴테이블 위 LP | 새로 들였어. / ……같이 들을 거면 와. |
| 마키아 | 밤 창가의 두다 만 체스판 | 네 차례다. / ……서두를 필요는 없다. |

---

## ruan — 새벽 사막 도로

```
no humans, pov, motorcycle, handlebars, motorcycle dashboard, desert highway, empty road, dawn, early morning, purple sky, orange horizon, distant city lights, road lines, wind, phone photo, 
seen from the seat of a stopped motorcycle at dawn, the handlebars and a glowing dashboard in the foreground, an empty desert highway running straight to a horizon just turning orange, the city lights fading far behind
```

## jenis — 빈 편지지와 만년필

```
no humans, still life, desk, letter paper, blank paper, fountain pen, envelope, wax seal, wristwatch, coffee cup, morning, window light, soft shadows, wooden desk, close-up, phone photo, 
a neat wooden desk in soft morning light, a sheet of cream letter paper left completely blank, an uncapped fountain pen resting across it, an unused envelope and a wristwatch set aside
```

## rainer — 비 오는 뉴올리언스 현관

```
no humans, scenery, house, front porch, creole cottage, wooden shutters, potted plant, flower pot, rain, wet street, gas lamp, evening, warm light, french quarter, phone photo, 
a small old cottage in the French Quarter seen from the street on a rainy evening, green wooden shutters closed, a single potted plant still green by the front step, a gas lamp glowing on the wet porch
```

## anzi — 옥상 테라스 셀카

캐릭터 기본(`../char/anzi_prompt.md`)을 앞에 붙인다.

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::smile::, wind, hair blowing, rooftop, terrace, night, city lights, neon lights, from above, close-up, phone photo, 
a casual selfie on the rooftop terrace of the Chronicle building at night, wind tossing his red hair, the neon city spread out behind him, a small amused smile as if he took it on a whim
```

## minos — 새벽 다이너 부스

```
no humans, still life, diner, booth, two coffee cups, coffee mug, notebook, closed notebook, table, window, dawn, neon sign, empty seat, phone photo, 
an empty 24-hour diner booth at dawn, two mugs of coffee on the table, one pushed toward the empty seat across, a closed police notebook beside the other, a pale neon sign glowing in the window
```

## jin — 턴테이블 위 LP

```
no humans, still life, turntable, vinyl record, record player, record sleeve, study, bookshelf, desk lamp, night, warm light, close-up, phone photo, 
a vinyl record turning on a turntable in a quiet study at night, a classical record sleeve leaning beside it, warm desk lamp light, rows of books blurred in the background
```

## maquia — 두다 만 체스판

```
no humans, still life, chessboard, chess pieces, chess, window, night, city lights, moonlight, marble, brass lamp, close-up, phone photo, 
a marble chessboard by a tall window at night, a game left half-finished with one side clearly waiting for the next move, the city lights far below, a brass lamp casting patterned light
```
