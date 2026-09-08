/**
 * ANTENNA × CATEGORY × DETAIL — the whole vocabulary, in one place.
 *
 * There is no MODE. crincran is one thing: finding a way of moving that suits
 * you, on the way to something you want. The person picks up to two antennas
 * and lives; the month-end pass reads what the antennas caught.
 *
 * Every id here is stored in the database. Labels are not.
 * `values_admired` reads 「いいなと思った」 today and read 「憧れた」 before;
 * the id did not change, so no log had to be rewritten. Keep it that way:
 * change labels freely, add ids, never rename or reuse one.
 */

export type AntennaId = 'progress' | 'self_understanding' | 'spark' | 'sustainable' | 'values';

export type CategoryId =
  | 'progress_did'
  | 'progress_learned'
  | 'progress_tried'
  | 'self_good'
  | 'self_hard'
  | 'self_fun'
  | 'spark_inspired'
  | 'spark_recharged'
  | 'spark_curious'
  | 'sustainable_easy'
  | 'sustainable_absorbed'
  | 'sustainable_relieved'
  | 'values_important'
  | 'values_wrong'
  | 'values_admired';

export type DetailId = string;

export interface DetailOption {
  id: DetailId;
  label: string;
}

export interface DailyCategory {
  id: CategoryId;
  antennaId: AntennaId;
  label: string;
  /** For the classifier. Never shown. */
  definition: string;
  /** Asked above the detail chips. */
  detailQuestion: string;
  details: readonly DetailOption[];
  /** Asked above the free text. The same for every category on purpose:
   *  a different question per category reads as an exam, and the category
   *  label already says what kind of day it was. */
  freeTextPrompt: string;
}

export interface AntennaDefinition {
  id: AntennaId;
  /** Used where a full title will not fit: the map, a summary line. */
  shortLabel: string;
  /** The orange card title. */
  title: string;
  /** Chooser card, line 2. A concrete situation, not an abstract description. */
  recommendedWhen: string;
  /** Chooser card, line 3. What the month gives back — material, not a verdict. */
  provides: string;
  /** Not shown. Handed to the month-end pass as this antenna's objective. */
  analysisObjective: string;
  categories: readonly DailyCategory[];
}

export const OTHER_DETAIL: DetailOption = { id: 'other', label: 'その他' };

const withOther = (details: readonly DetailOption[]): readonly DetailOption[] =>
  [...details, OTHER_DETAIL];

/** 活かし方の3カテゴリで共通の軸。同じ軸だからこそ、良い時と悪い時を比べられます。 */
const fitDetails = (): readonly DetailOption[] =>
  withOther([
    { id: 'activity', label: 'やっていたこと' },
    { id: 'role', label: '自分の役割' },
    { id: 'autonomy', label: '任され方' },
    { id: 'people', label: '一緒にいた人' },
    { id: 'place', label: '場所' },
    { id: 'environment', label: '環境' },
    { id: 'time_use', label: '時間の使い方' },
  ]);

/** 大切だと思った / なんか違った で共通。あった時と欠けた時を両方向から見ます。 */
const valueDetails = (): readonly DetailOption[] =>
  withOther([
    { id: 'freedom', label: '自由' },
    { id: 'growth', label: '成長' },
    { id: 'security', label: '安心' },
    { id: 'life', label: '暮らし' },
    { id: 'connection', label: '人とのつながり' },
    { id: 'meaning', label: 'やりがい' },
  ]);

export const ANTENNAS: Record<AntennaId, AntennaDefinition> = {
  progress: {
    id: 'progress',
    shortLabel: '前進',
    title: '前進を実感する',
    recommendedWhen: '頑張っているのに、前に進んでいる実感が持てない時に。',
    provides: '日々の「できた・学んだ」から、まだ結果になる前の成長を見つけます。',
    analysisObjective:
      '目標に向かう途中で、能力・経験・行動・学びとして何が積み上がっているかを明らかにする。',
    categories: [
      {
        id: 'progress_did',
        antennaId: 'progress',
        label: 'できた',
        definition: '以前できなかったことができた、上達した、続けられた、形になったなど、能力や実行上の前進。',
        detailQuestion: 'どんな「できた」だった？',
        details: withOther([
          { id: 'first_time', label: '初めてできた' },
          { id: 'did_better', label: '上手くできた' },
          { id: 'took_action', label: '動けた' },
          { id: 'kept_going', label: '続けられた' },
          { id: 'got_result', label: '結果が出た' },
          { id: 'did_again', label: 'またできた' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'progress_learned',
        antennaId: 'progress',
        label: '学んだ',
        definition: '経験・成功・失敗などから、新しく理解したことや次に活かせる学び。',
        detailQuestion: '何について分かった？',
        details: withOther([
          { id: 'method', label: 'やり方' },
          { id: 'strength', label: '得意なこと' },
          { id: 'difficulty', label: '苦手なこと' },
          { id: 'relationships', label: '人との関わり' },
          { id: 'money', label: 'お金' },
          { id: 'time', label: '時間' },
          { id: 'next', label: 'これから' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'progress_tried',
        antennaId: 'progress',
        label: 'やってみた',
        definition: '考えるだけで終わらず、新しい行動・試行・参加・挑戦を実際に起こしたこと。',
        detailQuestion: '何をやってみた？',
        details: withOther([
          { id: 'researched', label: '調べた' },
          { id: 'talked', label: '話した' },
          { id: 'went', label: '行ってみた' },
          { id: 'tested', label: '試した' },
          { id: 'made', label: '作った' },
          { id: 'delivered', label: '届けた' },
        ]),
        freeTextPrompt: '何があった？',
      },
    ],
  },

  self_understanding: {
    id: 'self_understanding',
    shortLabel: '活かし方',
    title: '自分の活かし方を知る',
    recommendedWhen: '頑張ればできるけれど、今のやり方が自分に合っているか分からない時に。',
    provides: '仕事もプライベートも含め、力が出やすい役割・環境・進め方を見つけます。',
    analysisObjective:
      '何をしている時、どんな進め方・人・環境・ペースで自然に機能するかを、仕事と私生活を横断して明らかにする。',
    categories: [
      {
        id: 'self_good',
        antennaId: 'self_understanding',
        label: '調子がよかった',
        definition: '集中できた、頭が働いた、自然に進んだなど、本人が機能しやすかった場面。',
        detailQuestion: '何が関係していそう？',
        details: fitDetails(),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'self_hard',
        antennaId: 'self_understanding',
        label: 'しんどかった',
        definition: '取り組み方・役割・人・環境などとの相性が悪く、力を出しにくかった場面。',
        detailQuestion: '何が関係していそう？',
        details: fitDetails(),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'self_fun',
        antennaId: 'self_understanding',
        label: '楽しかった',
        definition: '活動している最中に楽しさを感じた場面。娯楽だけでなく、適性の証拠にもなる。',
        detailQuestion: '何が関係していそう？',
        details: fitDetails(),
        freeTextPrompt: '何があった？',
      },
    ],
  },

  spark: {
    id: 'spark',
    shortLabel: 'ときめき',
    title: 'ときめく方向を知る',
    recommendedWhen: '目標はあるけれど、本当はどこへ向かいたいのか分からなくなった時に。',
    provides: '仕事や遊び、出会いなど、日常で心が動いたことから向かいたい方向を見つけます。',
    analysisObjective:
      '何から影響やエネルギーを受け、何をもっと知りたいと思うのかを横断し、未来の方向候補を明らかにする。',
    categories: [
      {
        id: 'spark_inspired',
        antennaId: 'spark',
        label: '影響を受けた',
        definition: '人・テーマ・作品・体験などに触れ、考えや進みたい方向に影響を受けた場面。',
        detailQuestion: '何から影響を受けた？',
        details: withOther([
          { id: 'person', label: '人' },
          { id: 'work', label: '作品' },
          { id: 'activity', label: 'やっていること' },
          { id: 'place', label: '場所' },
          { id: 'idea', label: 'アイデア' },
          { id: 'working_style', label: '働き方' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'spark_recharged',
        antennaId: 'spark',
        label: '心が充電された',
        definition: '触れた後に元気が戻った、希望が湧いたなど、心理的エネルギーが回復した体験。',
        detailQuestion: '何で元気になった？',
        details: withOther([
          { id: 'person', label: '人' },
          { id: 'activity', label: 'やったこと' },
          { id: 'work', label: '作品' },
          { id: 'place', label: '場所' },
          { id: 'nature', label: '自然' },
          { id: 'alone_time', label: '一人の時間' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'spark_curious',
        antennaId: 'spark',
        label: 'もっと知りたい',
        definition: 'その後も調べたい、関わりたいという好奇心が残った対象。',
        detailQuestion: '何をもっと知りたい？',
        details: withOther([
          { id: 'person', label: '人' },
          { id: 'work', label: '仕事' },
          { id: 'interest', label: '気になること' },
          { id: 'place', label: '場所' },
          { id: 'new_world', label: '知らない世界' },
          { id: 'working_style', label: '働き方' },
        ]),
        freeTextPrompt: '何があった？',
      },
    ],
  },

  sustainable: {
    id: 'sustainable',
    shortLabel: '続け方',
    title: '無理なく進む',
    recommendedWhen: '目標は諦めたくないけれど、今の進み方がしんどくなってきた時に。',
    provides: '負担を感じにくかった時や楽になった時から、続けやすい進み方を見つけます。',
    analysisObjective:
      '努力感が少なく自然に続けられる条件と、負荷を下げる方法を明らかにする。',
    categories: [
      {
        id: 'sustainable_easy',
        antennaId: 'sustainable',
        label: '苦じゃなかった',
        definition: '行動していたにもかかわらず、強い負担を感じなかった場面。',
        detailQuestion: '何が楽だった？',
        details: withOther([
          { id: 'amount', label: 'やる量' },
          { id: 'difficulty', label: '難しさ' },
          { id: 'autonomy', label: '任され方' },
          { id: 'people', label: '一緒にいた人' },
          { id: 'place', label: '場所' },
          { id: 'environment', label: '環境' },
          { id: 'time_use', label: '時間の使い方' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'sustainable_absorbed',
        antennaId: 'sustainable',
        label: '気づいたら時間が経っていた',
        definition: '活動に自然に没頭し、時間の経過への意識が薄くなっていた場面。',
        detailQuestion: '何をしていた？',
        details: withOther([
          { id: 'thinking', label: '考える' },
          { id: 'making', label: '作る' },
          { id: 'talking', label: '話す' },
          { id: 'researching', label: '調べる' },
          { id: 'moving', label: '動かす' },
          { id: 'organizing', label: '整理する' },
        ]),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'sustainable_relieved',
        antennaId: 'sustainable',
        label: '楽になった',
        definition: '重さがあった状態から、何らかの行動や変化によって楽になった場面。',
        detailQuestion: '何をしたら楽になった？',
        details: withOther([
          { id: 'rested', label: '休んだ' },
          { id: 'reduced', label: '減らした' },
          { id: 'split', label: '分けた' },
          { id: 'asked_help', label: '頼った' },
          { id: 'declined', label: '断った' },
          { id: 'changed_method', label: 'やり方を変えた' },
        ]),
        freeTextPrompt: '何があった？',
      },
    ],
  },

  values: {
    id: 'values',
    shortLabel: '価値観',
    title: '大切にしたいものを知る',
    recommendedWhen: 'やりたいことと、仕事・収入・生活などの間で何を優先するか迷う時に。',
    provides: '日々の「大切だと思った」「なんか違った」から、迷った時にも守りたいものを見つけます。',
    analysisObjective:
      '何を大切だと感じ、何に違和感を持ち、何に惹かれるのかから、意思決定で守りたい基準を明らかにする。',
    categories: [
      {
        id: 'values_important',
        antennaId: 'values',
        label: '大切だと思った',
        definition: '出来事を通じて、重要だ、失いたくない、守りたいと感じたこと。',
        detailQuestion: '何を大切だと思った？',
        details: valueDetails(),
        freeTextPrompt: '何があった？',
      },
      {
        id: 'values_wrong',
        antennaId: 'values',
        label: 'なんか違った',
        definition: '条件上は問題がなくても、違和感・不一致・納得できなさを感じた場面。',
        detailQuestion: '何が「違う」と感じた？',
        details: valueDetails(),
        freeTextPrompt: '何があった？',
      },
      {
        // 表示は「いいなと思った」。id は values_admired のまま（既存ログのため）。
        id: 'values_admired',
        antennaId: 'values',
        label: 'いいなと思った',
        definition: '人や生き方、働き方などを見て、自分もそうありたいと感じた場面。',
        detailQuestion: '何を「いいな」と思った？',
        details: withOther([
          { id: 'work', label: '仕事' },
          { id: 'working_style', label: '働き方' },
          { id: 'life', label: '暮らし' },
          { id: 'relationships', label: '人間関係' },
          { id: 'challenge', label: '挑戦' },
          { id: 'belonging', label: '居場所' },
        ]),
        freeTextPrompt: '何があった？',
      },
    ],
  },
};

export const ANTENNA_ORDER: readonly AntennaId[] = [
  'progress',
  'self_understanding',
  'spark',
  'sustainable',
  'values',
];

/**
 * Two, and the preview's 3 was the stale one.
 *
 * The month is the unit of observation, and a third axis is how a month stops
 * being about anything. Picking again next month is what makes two enough.
 */
export const MAX_ANTENNAS = 2;

export const ALL_CATEGORIES: readonly DailyCategory[] =
  ANTENNA_ORDER.flatMap((id) => ANTENNAS[id].categories);

export function getCategoryById(categoryId: CategoryId): DailyCategory {
  const category = ALL_CATEGORIES.find((item) => item.id === categoryId);
  if (!category) throw new Error(`Unknown categoryId: ${categoryId}`);
  return category;
}

export function getDetailById(categoryId: CategoryId, detailId: DetailId): DetailOption | null {
  return getCategoryById(categoryId).details.find((detail) => detail.id === detailId) ?? null;
}

export function antennaOfCategory(categoryId: CategoryId): AntennaId {
  return getCategoryById(categoryId).antennaId;
}

/** The categories the month shows, in the order the antennas were picked. */
export function categoriesFor(antennaIds: readonly AntennaId[]): DailyCategory[] {
  return antennaIds.flatMap((id) => [...ANTENNAS[id].categories]);
}

/**
 * What the model sees. Ids alone are opaque to it, so send the labels too —
 * 楽しかった × 任され方 × 原文 is three levels it can actually reason over.
 */
export function serializeLogForAI(log: {
  categoryId: CategoryId;
  detailId: DetailId | null;
  body: string;
}) {
  const category = getCategoryById(log.categoryId);
  const detail = log.detailId ? getDetailById(log.categoryId, log.detailId) : null;
  return {
    antennaId: category.antennaId,
    categoryId: category.id,
    categoryLabel: category.label,
    detailId: detail?.id ?? null,
    detailLabel: detail?.label ?? null,
    body: log.body,
  };
}

/**
 * One objective for the month-end pass. The chosen antennas are the axes.
 */
export const MONTHLY_ANALYSIS_OBJECTIVE = `
ユーザーは、目標や願いに向かう途中にいる。

この月の記録から、
「このユーザーにとって今どんな進み方が合いそうか」
を証拠ベースで明らかにする。

分析では、選択されたアンテナを主な観察軸として使う。

前進: 何が以前より積み上がったか。
自分の活かし方: どんな取り組み・進め方・人・環境・ペースで自然に機能したか。
ときめき: 何から影響を受け、何をもっと知りたいと思ったか。
無理なく進む: 何が苦にならず、何をすると楽になったか。
価値観: 何を大切だと感じ、何に違和感を持ち、何に惹かれたか。

断定しすぎないこと。
単発のログから性格や価値観を決めないこと。
複数の証拠と時系列を優先すること。
本人が書いていない Before を捏造しないこと。
失敗そのものを成長として扱わないこと。

最終的には、
「このまま進む / 進み方を変える / 目標の形を調整する」
ために使える見立てを返す。
`;
