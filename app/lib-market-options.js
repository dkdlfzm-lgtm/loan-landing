const propertyCatalog = {
  아파트: {
    서울시: {
      강남구: {
        삼성동: {
          래미안대치팰리스: ["84.97㎡", "114.15㎡"],
        },
        역삼동: {
          개나리래미안: ["59.96㎡", "84.93㎡"],
        },
      },
      송파구: {
        잠실동: {
          잠실엘스: ["84.88㎡", "119.96㎡"],
          리센츠: ["84.99㎡", "124.22㎡"],
        },
        신천동: {
          파크리오: ["59.92㎡", "84.97㎡", "144.77㎡"],
        },
      },
      마포구: {
        아현동: {
          마포래미안푸르지오: ["59.97㎡", "84.59㎡"],
        },
      },
      영등포구: {
        여의도동: {
          시범아파트: ["79.24㎡", "118.12㎡"],
        },
      },
    },
    경기도: {
      성남시: {
        분당구: {
          정자동: {
            파크뷰: ["84.98㎡", "139.12㎡"],
          },
          수내동: {
            양지마을금호1단지: ["58.2㎡", "84.12㎡"],
          },
        },
      },
      고양시: {
        일산동구: {
          장항동: {
            호수마을5단지: ["84.95㎡", "101.1㎡"],
          },
        },
      },
      수원시: {
        영통구: {
          영통동: {
            황골마을주공1단지: ["59.89㎡", "84.72㎡"],
          },
        },
      },
      구리시: {
        수택동: {
          LG원앙: ["59.97㎡", "84.96㎡", "107.28㎡"],
          금호어울림: ["59.88㎡", "84.72㎡"],
          나래아파트: ["84.91㎡"],
        },
      },
      화성시: {
        반송동: {
          동탄시범한빛마을: ["84.99㎡", "97.12㎡"],
        },
      },
    },
    인천광역시: {
      연수구: {
        송도동: {
          더샵센트럴파크1차: ["84.96㎡", "117.32㎡"],
        },
      },
      부평구: {
        삼산동: {
          삼산타운주공: ["59.95㎡", "84.96㎡"],
        },
      },
    },
    부산광역시: {
      해운대구: {
        우동: {
          해운대자이: ["84.98㎡", "112.45㎡"],
        },
        좌동: {
          해운대대림1차: ["59.9㎡", "84.97㎡"],
        },
      },
    },
    대구광역시: {
      수성구: {
        범어동: {
          범어SK뷰: ["84.97㎡", "114.88㎡"],
        },
      },
    },
    광주광역시: {
      서구: {
        치평동: {
          상무라인대주: ["84.91㎡", "101.22㎡"],
        },
      },
    },
    대전광역시: {
      유성구: {
        봉명동: {
          유성자이: ["84.95㎡", "101.77㎡"],
        },
      },
    },
    울산광역시: {
      남구: {
        달동: {
          달동삼성래미안: ["84.93㎡", "114.03㎡"],
        },
      },
    },
    세종특별자치시: {
      세종시: {
        새롬동: {
          새뜸마을7단지: ["84.94㎡", "99.12㎡"],
        },
      },
    },
    강원특별자치도: {
      춘천시: {
        퇴계동: {
          e편한세상춘천: ["84.95㎡", "114.62㎡"],
        },
      },
    },
    충청북도: {
      청주시: {
        흥덕구: {
          복대동: {
            복대자이더스카이: ["84.96㎡", "103.11㎡"],
          },
        },
      },
    },
    충청남도: {
      천안시: {
        서북구: {
          불당동: {
            불당호반베르디움: ["84.97㎡", "99.88㎡"],
          },
        },
      },
    },
    전북특별자치도: {
      전주시: {
        완산구: {
          효자동: {
            효자엘드수목토: ["84.9㎡", "120.31㎡"],
          },
        },
      },
    },
    전라남도: {
      순천시: {
        왕지동: {
          순천왕지롯데캐슬: ["84.95㎡", "112.02㎡"],
        },
      },
    },
    경상북도: {
      포항시: {
        남구: {
          대잠동: {
            포항자이: ["84.96㎡", "120.55㎡"],
          },
        },
      },
    },
    경상남도: {
      창원시: {
        성산구: {
          상남동: {
            성원토월그랜드타운: ["59.82㎡", "84.94㎡"],
          },
        },
      },
    },
    제주특별자치도: {
      제주시: {
        노형동: {
          노형뜨란채: ["84.83㎡", "114.14㎡"],
        },
      },
    },
  },
  오피스텔: {
    서울시: {
      강남구: {
        역삼동: {
          역삼푸르지오시티: ["29.84㎡", "59.12㎡"],
          강남역서희스타힐스: ["23.12㎡", "42.88㎡"],
        },
      },
      마포구: {
        공덕동: {
          공덕오피스텔A: ["29.32㎡", "49.84㎡"],
        },
      },
    },
    부산광역시: {
      해운대구: {
        우동: {
          센텀하이브오피스텔: ["29.97㎡", "58.64㎡"],
        },
      },
    },
  },
  "빌라(연립/다세대)": {
    서울시: {
      강서구: {
        화곡동: {
          화곡빌라A: ["42.11㎡", "59.02㎡"],
          화곡빌라B: ["52.44㎡", "73.18㎡"],
        },
      },
    },
    경기도: {
      부천시: {
        원미구: {
          상동: {
            상동연립주택: ["48.21㎡", "59.77㎡"],
          },
        },
      },
    },
  },
};

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

function collectEntries(node, path = [], out = []) {
  if (!node || typeof node !== "object") return out;

  for (const [key, value] of Object.entries(node)) {
    if (Array.isArray(value)) {
      const fullPath = [...path, key];
      const apartment = fullPath[fullPath.length - 1] || "";
      const locationParts = fullPath.slice(0, -1);
      const town = locationParts[locationParts.length - 1] || "기타";
      const districtParts = locationParts.slice(0, -1);
      const district = districtParts.length ? districtParts.join(" ") : "기타";

      out.push({ district, town, apartment, areas: value });
      continue;
    }

    collectEntries(value, [...path, key], out);
  }

  return out;
}

const normalizedCatalog = Object.fromEntries(
  Object.entries(propertyCatalog).map(([propertyType, cityMap]) => [
    propertyType,
    Object.fromEntries(
      Object.entries(cityMap).map(([city, node]) => [city, collectEntries(node)])
    ),
  ])
);

function getEntries(propertyType, city) {
  return normalizedCatalog[propertyType]?.[city] || [];
}

export function getCities(propertyType) {
  return Object.keys(normalizedCatalog[propertyType] || {});
}

export function getDistricts(propertyType, city) {
  return unique(getEntries(propertyType, city).map((entry) => entry.district));
}

export function getTowns(propertyType, city, district) {
  return unique(
    getEntries(propertyType, city)
      .filter((entry) => entry.district === district)
      .map((entry) => entry.town)
  );
}

export function getApartments(propertyType, city, district, town) {
  return unique(
    getEntries(propertyType, city)
      .filter((entry) => entry.district === district && entry.town === town)
      .map((entry) => entry.apartment)
  );
}

export function getAreas(propertyType, city, district, town, apartment) {
  const matched = getEntries(propertyType, city).find(
    (entry) =>
      entry.district === district && entry.town === town && entry.apartment === apartment
  );
  return matched?.areas || [];
}
