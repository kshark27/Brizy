/* eslint-disable @typescript-eslint/no-use-before-define */
import Config from "visual/global/Config";
import { pageSplitRules } from "../getAllowedGBIds";

import { IS_WP, IS_TEMPLATE } from "visual/utils/models";
import { GlobalBlock, GlobalBlockPosition } from "visual/types";
import { Config as ConfigType } from "./config";

export const PAGES_GROUP_ID = 1;
export const POST_GROUP_ID = 1;
export const CATEGORIES_GROUP_ID = 2;
export const TEMPLATES_GROUP_ID = 16;

export const PAGE_TYPE = "page";
export const POST_TYPE = "post";
export const TEMPLATE_TYPE = "brizy_template";

import {
  PB,
  GBIds,
  GBP,
  GB,
  GBPWithoutNull,
  PositionAlign,
  AlignsList,
  SortedGBPositions,
  Rule,
  SurroundedConditionsIds,
  InsertScheme
} from "./types";

function getGBIdsInPage(blocksOrder: PB, globalBlocks: GB): PB {
  return blocksOrder.filter(id => globalBlocks[id]);
}

function getGBChunks(
  GBIdsInPage: PB,
  sourceGBIds: PB,
  GBTopIds: PB
): InsertScheme {
  const insertScheme: InsertScheme = {};
  let queue: SortedGBPositions = [];
  let lastSourceId = "";

  GBIdsInPage.forEach((id, index, arr) => {
    const isSourceGBId = sourceGBIds.includes(id);

    if (isSourceGBId) {
      insertScheme[id] = { ...insertScheme[id], before: queue };
      lastSourceId = id;
      queue = [];
    }

    if (!isSourceGBId) {
      queue.push({
        globalBlockId: id,
        // write a function which will return top | botoom by id
        align: GBTopIds.includes(id) ? "top" : "bottom"
      });
    }

    if (index === arr.length - 1 && queue.length) {
      insertScheme[lastSourceId] = {
        ...insertScheme[lastSourceId],
        after: queue
      };
    }
  });

  return insertScheme;
}

function applyScheme(
  sourcePositionsArr: SortedGBPositions,
  insertScheme: InsertScheme
): SortedGBPositions {
  // ! an ugly-ugly temp hack. happens only when there isn't any another global blocks
  if (!sourcePositionsArr.length && insertScheme[""]?.after) {
    return insertScheme[""].after;
  } else if (sourcePositionsArr.length && insertScheme[""]) {
    insertScheme[sourcePositionsArr[0].globalBlockId] = insertScheme[""];
    delete insertScheme[""];
  }

  const newPositionArr = sourcePositionsArr.reduce((acc, position) => {
    const id = position.globalBlockId;

    if (insertScheme[id]?.before) {
      acc.push(...insertScheme[id].before);
    }

    acc.push(position);

    if (insertScheme[id]?.after) {
      acc.push(...insertScheme[id].after);
    }

    return acc;
  }, [] as SortedGBPositions);

  return newPositionArr;
}

function replaceSourcePositions(
  sourcePositionsArr: SortedGBPositions,
  sourceGBIds: PB,
  GBTopIds: PB
): SortedGBPositions {
  // ! find a better way to implement this
  const newSourceGBIds = [...sourceGBIds];
  return sourcePositionsArr.reduce((acc, item) => {
    if (sourceGBIds.includes(item.globalBlockId)) {
      const currentId = newSourceGBIds.shift();

      // this conditions is needed only for typescript
      if (currentId) {
        acc.push({
          globalBlockId: currentId,
          align: GBTopIds.includes(currentId) ? "top" : "bottom"
        });
      }
    } else {
      acc.push(item);
    }

    return acc;
  }, [] as SortedGBPositions);
}

export function getPositions(blocksOrder: PB, globalBlocks: GB): GBP {
  const globalBlocksIds = Object.keys(globalBlocks);

  const sourcePositionObj = Object.entries(globalBlocks).reduce(
    (acc, [id, block]) => {
      if (block.position) {
        acc[id] = block.position;
      }

      return acc;
    },
    {} as GBPWithoutNull
  );

  const sourcePositionsArr = turnPositionsIntoSortedArray(sourcePositionObj);

  const { top: GBTopIds } = getSurroundedGBIds(blocksOrder, globalBlocksIds);

  const GBIdsInPage = getGBIdsInPage(blocksOrder, globalBlocks);
  const sourceGBIds = GBIdsInPage.filter(id => sourcePositionObj[id]);

  const insertScheme = getGBChunks(GBIdsInPage, sourceGBIds, GBTopIds);

  const sourceTop = replaceSourcePositions(
    sourcePositionsArr.top,
    sourceGBIds,
    GBTopIds
  );
  const newTop = applyScheme(sourceTop, insertScheme);

  const sourceBottom = replaceSourcePositions(
    sourcePositionsArr.bottom,
    sourceGBIds,
    GBTopIds
  );
  const newBottom = applyScheme(sourceBottom, insertScheme);

  const newPosition = turnPositionsIntoObject(newTop, newBottom);

  return newPosition;
}

export const getSurroundedGBIds = (
  pageBlocksIds: PB,
  globalBlocksIds: GBIds
): SurroundedConditionsIds => {
  const surroundedConditionsIds: SurroundedConditionsIds = {
    top: [],
    bottom: []
  };

  if (pageBlocksIds.length > 0) {
    let i = 0;
    while (i <= pageBlocksIds.length - 1) {
      const currentBlockId = pageBlocksIds[i];
      if (globalBlocksIds.includes(currentBlockId)) {
        surroundedConditionsIds.top.push(currentBlockId);
      } else {
        break;
      }
      i++;
    }

    i = 0;
    while (i <= pageBlocksIds.length - 1) {
      const currentBlockId = pageBlocksIds[pageBlocksIds.length - 1 - i];
      if (globalBlocksIds.includes(currentBlockId)) {
        surroundedConditionsIds.bottom.push(currentBlockId);
      } else {
        break;
      }
      i++;
    }
  }

  return surroundedConditionsIds;
};

function turnPositionsIntoSortedArray(
  positions: GBPWithoutNull
): {
  top: SortedGBPositions;
  bottom: SortedGBPositions;
} {
  type PositionsAsArray = {
    top: (GlobalBlockPosition & { globalBlockId: string })[];
    bottom: (GlobalBlockPosition & { globalBlockId: string })[];
  };

  const { top, bottom } = Object.entries(positions).reduce(
    (acc, [globalBlockId, value]): PositionsAsArray => {
      acc.top.push({
        ...value,
        globalBlockId,
        // normaly align should always exist.It's needed only
        // for old global blocks
        align: value.align || "top"
      });
      acc.bottom.push({
        ...value,
        globalBlockId,
        align: value.align || "top"
      });

      return acc;
    },
    {
      top: [],
      bottom: []
    } as PositionsAsArray
  );

  return {
    top: sortedGlobalBlockIds(top, "top"),
    bottom: sortedGlobalBlockIds(bottom, "bottom")
  };

  function sortedGlobalBlockIds(
    positions: PositionsAsArray["top"] | PositionsAsArray["bottom"],
    type: "top" | "bottom"
  ): SortedGBPositions {
    return positions
      .sort((a, b) => a[type] - b[type])
      .map(({ globalBlockId, align }) => ({
        globalBlockId,
        align
      }));
  }
}

function turnPositionsIntoObject(
  top: SortedGBPositions,
  bottom: SortedGBPositions
): GBPWithoutNull {
  const acc: GBPWithoutNull = {};

  transformPosition(top, "top", acc);
  transformPosition(bottom, "bottom", acc);

  return acc;

  function transformPosition(
    positions: SortedGBPositions,
    type: PositionAlign,
    accumulator: GBPWithoutNull
  ): GBPWithoutNull {
    return positions.reduce((acc, { globalBlockId, align }, index) => {
      acc[globalBlockId] = {
        ...acc[globalBlockId],
        align,
        [type]: index
      };

      return acc;
    }, accumulator);
  }
}

export const getCurrentRule = (): Rule => {
  const { page, ruleMatches }: ConfigType["wp"] = Config.get("wp");

  if (IS_TEMPLATE) {
    return {
      group: TEMPLATES_GROUP_ID,
      type: TEMPLATE_TYPE,
      id: page
    };
  }

  if (ruleMatches[0].entityType === POST_TYPE) {
    return {
      group: POST_GROUP_ID,
      type: POST_TYPE,
      id: page
    };
  }

  return {
    group: PAGES_GROUP_ID,
    type: PAGE_TYPE,
    id: page
  };
};

export const getSurroundedConditions = (
  pageBlocksIds: PB,
  globalBlocksIds: GBIds
): SurroundedConditionsIds => {
  const surroundedConditionsIds: SurroundedConditionsIds = {
    top: [],
    bottom: []
  };

  if (pageBlocksIds.length > 0) {
    let i = 0;
    while (i <= pageBlocksIds.length - 1) {
      const currentBlockId = pageBlocksIds[i];
      if (globalBlocksIds.includes(currentBlockId)) {
        surroundedConditionsIds.top.push(currentBlockId);
      } else {
        break;
      }
      i++;
    }

    i = 0;
    while (i <= pageBlocksIds.length - 1) {
      const currentBlockId = pageBlocksIds[pageBlocksIds.length - 1 - i];
      if (globalBlocksIds.includes(currentBlockId)) {
        surroundedConditionsIds.bottom.push(currentBlockId);
      } else {
        break;
      }
      i++;
    }
  }

  return surroundedConditionsIds;
};

export const getBlockAlignment = (
  pageBlocksIds: PB,
  index: number,
  globalBlockIds: GBIds
): AlignsList => {
  const prevBlockId = pageBlocksIds[index - 1];
  const nextBlockId = pageBlocksIds[index + 1];

  const { top, bottom } = getSurroundedConditions(
    pageBlocksIds,
    globalBlockIds
  );

  let align: AlignsList = "center";
  if (
    !prevBlockId ||
    (globalBlockIds.includes(prevBlockId) && top.includes(prevBlockId))
  ) {
    align = "top";
  } else if (
    !nextBlockId ||
    (globalBlockIds.includes(nextBlockId) && bottom.includes(nextBlockId))
  ) {
    align = "bottom";
  }

  return align;
};

export const changeRule = (
  globalBlock: GlobalBlock,
  shouldAddIncludeCondition: boolean
): GlobalBlock => {
  if (!IS_WP) return globalBlock;

  const currentRule = getCurrentRule();
  // when types for getAllowedGBIds will be done replace this line
  const {
    level2,
    level3
  }: { level2: boolean; level3: boolean } = pageSplitRules(globalBlock.rules);

  let newGlobalBlock = {
    ...globalBlock,
    rules: globalBlock.rules.filter(
      ({ entityValues }) => !entityValues.includes(currentRule.id)
    )
  };

  const shouldAddRule = shouldAddIncludeCondition
    ? IS_TEMPLATE || (!IS_TEMPLATE && !level2 && !level3)
    : IS_TEMPLATE || (!IS_TEMPLATE && (level2 || level3));

  if (shouldAddRule) {
    newGlobalBlock = {
      ...newGlobalBlock,
      rules: [
        ...newGlobalBlock.rules,
        {
          type: shouldAddIncludeCondition ? 1 : 2,
          appliedFor: currentRule.group,
          entityType: currentRule.type,
          entityValues: [currentRule.id]
        }
      ]
    };
  }

  return newGlobalBlock;
};
