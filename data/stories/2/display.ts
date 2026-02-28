import type { StoryDisplayConfig } from '@/data/registry';

export const VICTIM_NAME = "에녹 드레버";

export const SYNOPSIS = {
    short: "밀실이나 다름없는 낡은 저택에서 발견된 남자의 시신. 청색증을 띤 그의 얼굴과 기묘한 자세만이 유일한 단서다.",
    full: "1880년대 어느 안개 낀 런던의 아침. 브릭스톤 로드 3 번지에 위치한 오랫동안 비어있던 낡은 저택에서 끔찍한 시신이 발견되었습니다.\n\n피해자는 미국인 에녹 드레버. 그의 얼굴은 고통으로 심하게 일그러져 있었고 입술 주변은 확연한 청색증(Cyanosis)을 띠고 있었습니다. 그러나 외상은 전혀 없었으며 방 안은 안쪽에서 잠겨있지 않았음에도 완벽한 밀실처럼 정돈되어 있었습니다.\n\n바닥에는 두 사람의 진흙 묻은 발자국, 그리고 벽에는 피로 쓰여진 듯한 붉은 글씨가 희미하게 남아있습니다. 경찰은 혼란에 빠졌고, 이 기이한 죽음의 진상을 밝혀낼 유일한 사람은 바로 당신입니다."
};

export const defaultSuggestions = [
    "현장의 상태를 묘사해줘.",
    "바닥에 남아있는 발자국은 어떤 형태야?",
    "에녹 드레버의 주머니에서 나온 소지품은?",
    "가장 먼저 현장을 발견한 순경의 진술이 궁금해."
];

export const displayStruct: StoryDisplayConfig = {
    VICTIM_NAME,
    SYNOPSIS,
    defaultSuggestions
};
