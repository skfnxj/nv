# `photo` — 디바이스 사진 메시지 (각별함 단계)

홈페이지 디바이스 대화에서 호감이 **각별함(85)**이 되면 캐릭터가 보내 주는 사진 한 장이에요.

- 파일 이름: `<캐릭터>.webp` (예: `ruan.webp`). 이 폴더에 넣으면 돼요.
- 파일이 없으면 홈페이지는 사진을 보내지 않고 기다려요. 나중에 올리면 그때 와요.
- 휴대폰으로 찍은 느낌이라 세로 3:4를 권장해요(예: 832×1104). 대화창에서는 폭 240px으로 줄여서 보여요.
- 조합: **그림체 고정**(`../../프롬프트_그림체고정.txt`의 [품질]·[작가]·[조명]·[기법]·[인체]) + 아래 장면.
- 7장 모두 **셀카**예요. 각 캐릭터 기본(`../char/<캐릭터>_prompt.md`의 외모·헤어·소품)을 앞에 붙여요.

| 캐릭터 | 사진 | 보내며 하는 말 |
|---|---|---|
| 루안 | 새벽 사막 도로, 바이크에 앉아 셀카 | 새벽에 달리다 찍었다. / ……다음엔 뒤에 타. |
| 제니스 | 빈 편지지 놓인 책상 앞 셀카 | 책상 정리하다가요. / ……아직 한 줄도 못 썼어요. |
| 레이너 | 비 오는 뉴올리언스 작은 집 현관 셀카 | 뉴올리언스 왔어요. 비 와요. / 문 앞 화분, 아직 살아 있더라고요. |
| 안지 | 크로니클 옥상 테라스 셀카 | 1면 사진 아님. 그냥 찍었어. / 흠. 저장해 둬도 돼. |
| 미노스 | 새벽 다이너 부스 셀카, 맞은편 커피 | 끝났다. 다이너. / ……네 자리 비어 있다. |
| 진 | 서재 턴테이블 옆 셀카 | 새로 들였어. / ……같이 들을 거면 와. |
| 마키아 | 두다 만 체스판 앞 셀카 | 네 차례다. / ……서두를 필요는 없다. |

---

공통: 각 캐릭터 기본(외모·헤어·소품)을 맨 앞에 붙인다. 표정 태그는 캐릭터 e01 기본 표정에 맞췄다.

## ruan — 새벽 사막 도로 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::smirk::, sitting on motorcycle, chain necklace, wind, desert highway, empty road, dawn, purple sky, orange horizon, from above, close-up, phone photo, 
a quick selfie taken from the seat of a stopped motorcycle at dawn, wind in his silver hair, an empty desert highway running to an orange horizon behind him, a lazy one-sided smirk as if he only took it because you would ask
```

## jenis — 빈 편지지 놓인 책상 앞 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::knowing smile::, gentle eyes, slight blush, sitting, desk, letter paper, blank paper, fountain pen, envelope, wristwatch, morning, window light, from above, close-up, phone photo, 
a polite, slightly self-conscious selfie at a neat wooden desk in soft morning light, a sheet of cream letter paper left blank and a fountain pen visible in front of him
```

## rainer — 비 오는 뉴올리언스 현관 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::gentle smile::, head tilt, wet hair, front porch, creole cottage, green wooden shutters, potted plant, rain, gas lamp, evening, warm light, french quarter, close-up, phone photo, 
a soft selfie under the porch roof of a small old cottage in the French Quarter on a rainy evening, rain falling behind him, a single green potted plant by the door, the gas lamp warming one side of his face
```

## anzi — 옥상 테라스 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::smile::, wind, hair blowing, rooftop, terrace, night, city lights, neon lights, from above, close-up, phone photo, 
a casual selfie on the rooftop terrace of the Chronicle building at night, wind tossing his red hair, the neon city spread out behind him, a small amused smile as if he took it on a whim
```

## minos — 새벽 다이너 부스 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::light smile::, stoic, tired eyes, sitting, diner, booth, coffee mug, two coffee cups, table, window, dawn, neon sign, close-up, phone photo, 
an awkward, stiff selfie in an empty 24-hour diner booth at dawn after a night shift, a second mug of coffee pushed toward the empty seat across from him, pale neon glowing in the window
```

## jin — 서재 턴테이블 옆 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::serious::, slight blush, loose bangs, turntable, vinyl record, study, bookshelf, desk lamp, night, warm light, close-up, phone photo, 
a stiff, carefully framed selfie in a quiet study at night, a vinyl record turning on the turntable beside him, warm desk lamp light, as if he is unused to taking pictures of himself
```

## maquia — 두다 만 체스판 앞 셀카

```
1boy, selfie, holding phone, upper body, looking at viewer, 1.5::expressionless::, chessboard, chess pieces, window, night, city lights, moonlight, brass lamp, from side, close-up, phone photo, 
a composed selfie by a tall window at night, a marble chessboard with a half-finished game in front of him, one side waiting for the next move, the city lights far below
```
