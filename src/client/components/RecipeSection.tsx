import {
  BookOpen,
  Calculator,
  ChevronRight,
  Flame,
  GitBranch,
  Hammer,
  Layers,
  Sparkles,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import type {
  RecipeDetail,
  RecipeTreeNode,
  UsedInRecipeItem,
} from '../../shared/types'
import { getIconUrl } from '../api'

interface RecipeSectionProps {
  recipes: RecipeDetail[]
  recipeTree?: RecipeTreeNode
  usedInRecipes: UsedInRecipeItem[]
  onSelectItem: (itemId: number) => void
}

interface AggregatedMaterial {
  itemId: number
  nameCn: string
  iconId: number
  totalAmount: number
  isGatherable: boolean
  isCrystal: boolean
}

/**
 * 递归汇总配方树所需的底层基础原材料与水晶总数
 */
function aggregateBaseMaterials(
  node: RecipeTreeNode,
  requiredOutputQty: number,
  materialMap: Map<number, AggregatedMaterial>,
) {
  const craftsNeeded = Math.max(
    1,
    Math.ceil(requiredOutputQty / (node.yieldPerCraft || 1)),
  )

  for (const cry of node.crystals) {
    const existing = materialMap.get(cry.itemId)
    const addAmt = cry.amount * craftsNeeded
    if (existing) {
      existing.totalAmount += addAmt
    } else {
      materialMap.set(cry.itemId, {
        itemId: cry.itemId,
        nameCn: cry.nameCn,
        iconId: cry.iconId,
        totalAmount: addAmt,
        isGatherable: true,
        isCrystal: true,
      })
    }
  }

  for (const child of node.children) {
    const childRequired = child.amountPerCraft * craftsNeeded
    if (child.children.length > 0) {
      aggregateBaseMaterials(child, childRequired, materialMap)
    } else {
      const existing = materialMap.get(child.itemId)
      if (existing) {
        existing.totalAmount += childRequired
      } else {
        materialMap.set(child.itemId, {
          itemId: child.itemId,
          nameCn: child.nameCn,
          iconId: child.iconId,
          totalAmount: childRequired,
          isGatherable: child.isGatherable,
          isCrystal: false,
        })
      }
    }
  }
}

function formatStars(stars: number): string {
  return stars > 0 ? ` · ${stars}星` : ''
}

function RecipeTreeItemView({
  node,
  parentCrafts,
  onSelectItem,
}: {
  node: RecipeTreeNode
  parentCrafts: number
  onSelectItem: (itemId: number) => void
}) {
  const totalNeeded = node.amountPerCraft * parentCrafts
  const craftsNeeded = Math.max(
    1,
    Math.ceil(totalNeeded / (node.yieldPerCraft || 1)),
  )

  return (
    <div className="space-y-1.5">
      <div
        onClick={() => onSelectItem(node.itemId)}
        className="flex cursor-pointer items-center justify-between rounded-[6px] border border-[#e8eaec] bg-white px-3 py-2 text-[12px] transition-colors hover:border-[#cdced1] hover:bg-[#f4f6f8]"
      >
        <div className="flex items-center gap-2">
          <img
            src={getIconUrl(node.iconId)}
            alt={node.nameCn}
            className="h-6 w-6 rounded-[4px] border border-[#e8eaec]"
          />
          <div>
            <span className="font-medium text-[#131416]">{node.nameCn}</span>
            {node.craftJobName && (
              <span className="ml-2 pill pill-neutral num">
                {node.craftJobIconId && (
                  <img
                    src={getIconUrl(node.craftJobIconId)}
                    alt={node.craftJobName}
                    className="h-3 w-3"
                  />
                )}
                {node.craftJobName} Lv.{node.recipeLevel}
                {formatStars(node.stars || 0)}
              </span>
            )}
            {!node.craftJobName && node.isGatherable && (
              <span className="ml-2 pill pill-positive">可采集基础素材</span>
            )}
          </div>
        </div>
        <div className="text-[12px] font-semibold text-[#1b6c80] num">
          ×{totalNeeded}
          {node.yieldPerCraft > 1 && node.children.length > 0 && (
            <span className="ml-1 text-[11px] font-normal text-[#5d5f60]">
              (制作 {craftsNeeded} 次)
            </span>
          )}
        </div>
      </div>

      {node.children.length > 0 && (
        <div className="ml-4 space-y-1.5 border-l border-[#e8eaec] pl-3">
          {node.children.map((child) => (
            <RecipeTreeItemView
              key={child.itemId}
              node={child}
              parentCrafts={craftsNeeded}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 制作配方详情、原材料递归计算器与道具作为原料的用途面板 (To-B Framed-Sheet 风格)
 */
export function RecipeSection({
  recipes,
  recipeTree,
  usedInRecipes,
  onSelectItem,
}: RecipeSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0)
  const [craftCount, setCraftCount] = useState(1)

  const currentRecipe = recipes[activeIdx] || recipes[0]

  const aggregatedMaterials = useMemo(() => {
    if (!recipeTree || recipeTree.children.length === 0) return null
    const map = new Map<number, AggregatedMaterial>()
    const targetOutput = craftCount * (currentRecipe?.resultAmount || 1)
    aggregateBaseMaterials(recipeTree, targetOutput, map)
    const all = Array.from(map.values())
    return {
      baseItems: all.filter((m) => !m.isCrystal),
      crystals: all.filter((m) => m.isCrystal),
    }
  }, [recipeTree, craftCount, currentRecipe])

  if (recipes.length === 0 && usedInRecipes.length === 0) {
    return null
  }

  return (
    <div className="space-y-4">
      {/* 1. 该道具的制作配方 */}
      {currentRecipe && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Hammer className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                能工巧匠制作配方
              </h3>
              <span className="pill pill-neutral num">
                {recipes.length} 种职业可制作
              </span>
            </div>

            {recipes.length > 1 && (
              <div className="flex flex-wrap gap-1">
                {recipes.map((r, idx) => (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setActiveIdx(idx)}
                    className={`inline-flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12px] font-medium transition-colors ${
                      idx === activeIdx
                        ? 'bg-[#1d1f20] text-white'
                        : 'border border-[#e8eaec] bg-[#f4f6f8] text-[#5d5f60] hover:text-[#131416]'
                    }`}
                  >
                    <img
                      src={getIconUrl(r.craftJobIconId)}
                      alt={r.craftJobName}
                      className="h-3.5 w-3.5"
                    />
                    <span>{r.craftJobName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="p-4">
            {/* 配方职业与工序要求 */}
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3.5">
              <div className="flex items-center gap-3">
                <img
                  src={getIconUrl(currentRecipe.craftJobIconId)}
                  alt={currentRecipe.craftJobName}
                  className="h-9 w-9 rounded-[6px] border border-[#e8eaec] bg-white p-1"
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#131416]">
                      {currentRecipe.craftJobName} ({currentRecipe.craftTypeName})
                    </span>
                    <span className="pill pill-accent num">
                      Lv.{currentRecipe.recipeLevel}{' '}
                      {formatStars(currentRecipe.stars)}
                    </span>
                    {currentRecipe.resultAmount > 1 && (
                      <span className="pill pill-positive num">
                        单次产出 ×{currentRecipe.resultAmount}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-[#5d5f60]">
                    <span className="num">Recipe #{currentRecipe.id}</span>
                    {currentRecipe.secretRecipeBookName && (
                      <span className="pill pill-warning">
                        <BookOpen className="h-3 w-3" />
                        需秘籍: {currentRecipe.secretRecipeBookName}
                      </span>
                    )}
                    {currentRecipe.isSpecializationRequired && (
                      <span className="pill pill-negative">需专家之证</span>
                    )}
                    {currentRecipe.isExpert && (
                      <span className="pill pill-warning">高难配方</span>
                    )}
                    {currentRecipe.canQuickSynth && (
                      <span className="pill pill-neutral">可简易制作</span>
                    )}
                  </div>
                </div>
              </div>

              {/* 制作参数指标格 */}
              <div className="grid grid-cols-3 gap-2 text-right sm:grid-cols-6">
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">作业难度</div>
                  <div className="text-[12px] font-semibold text-[#131416] num">
                    {currentRecipe.difficulty}
                  </div>
                </div>
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">最高品质</div>
                  <div className="text-[12px] font-semibold text-[#1b6c80] num">
                    {currentRecipe.quality}
                  </div>
                </div>
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">耐久度</div>
                  <div className="text-[12px] font-semibold text-[#1e7b4f] num">
                    {currentRecipe.durability}
                  </div>
                </div>
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">
                    {currentRecipe.requiredCraftsmanship > 0
                      ? '要求作业'
                      : '推荐作业'}
                  </div>
                  <div className="text-[12px] font-semibold text-[#131416] num">
                    {currentRecipe.requiredCraftsmanship ||
                      currentRecipe.suggestedCraftsmanship}
                  </div>
                </div>
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">要求加工</div>
                  <div className="text-[12px] font-semibold text-[#131416] num">
                    {currentRecipe.requiredControl || '-'}
                  </div>
                </div>
                <div className="rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5">
                  <div className="text-[11px] text-[#5d5f60]">初期品质</div>
                  <div className="text-[12px] font-semibold text-[#131416] num">
                    {currentRecipe.materialQualityFactor}%
                  </div>
                </div>
              </div>
            </div>

            {/* 直接素材与水晶列表 */}
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#131416]">
                  <Layers className="h-3.5 w-3.5 text-[#1b6c80]" />
                  直接所需素材 (点击可跳转检索)
                </h4>
                <div className="space-y-1.5">
                  {currentRecipe.ingredients.map((ing) => (
                    <button
                      key={ing.itemId}
                      type="button"
                      onClick={() => onSelectItem(ing.itemId)}
                      className="flex w-full items-center justify-between rounded-[6px] border border-[#e8eaec] bg-white px-3 py-2 text-left transition-colors hover:border-[#cdced1] hover:bg-[#f9fbfc]"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getIconUrl(ing.iconId)}
                          alt={ing.nameCn}
                          className="h-7 w-7 rounded-[4px] border border-[#e8eaec] bg-[#f4f6f8]"
                        />
                        <div>
                          <div className="text-[12px] font-medium text-[#131416]">
                            {ing.nameCn}
                          </div>
                          <div className="flex items-center gap-1.5 text-[11px] text-[#5d5f60] num">
                            <span>iLvl {ing.itemLevel}</span>
                            {ing.isCraftable && <span>· 可制作半成品</span>}
                            {ing.isGatherable && (
                              <span className="text-[#1e7b4f]">· 可采集</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold text-[#1b6c80] num">
                          ×{ing.amount}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#6b6b6b]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#131416]">
                  <Flame className="h-3.5 w-3.5 text-[#1b6c80]" />
                  消耗水晶媒介
                </h4>
                <div className="space-y-1.5">
                  {currentRecipe.crystals.map((cry) => (
                    <button
                      key={cry.itemId}
                      type="button"
                      onClick={() => onSelectItem(cry.itemId)}
                      className="flex w-full items-center justify-between rounded-[6px] border border-[#e8eaec] bg-white px-3 py-2 text-left transition-colors hover:border-[#cdced1] hover:bg-[#f9fbfc]"
                    >
                      <div className="flex items-center gap-2.5">
                        <img
                          src={getIconUrl(cry.iconId)}
                          alt={cry.nameCn}
                          className="h-7 w-7 rounded-[4px] border border-[#e8eaec] bg-[#f4f6f8]"
                        />
                        <div>
                          <div className="text-[12px] font-medium text-[#131416]">
                            {cry.nameCn}
                          </div>
                          <div className="text-[11px] text-[#6b6b6b] num">
                            水晶 #{cry.itemId}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-[13px] font-semibold text-[#1b6c80] num">
                          ×{cry.amount}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-[#6b6b6b]" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* 递归材料计算器与分解树 */}
            {recipeTree && aggregatedMaterials && (
              <div className="mt-4 border-t border-[#e8eaec] pt-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Calculator className="h-4 w-4 text-[#1b6c80]" />
                    <h4 className="text-[13px] font-semibold text-[#131416]">
                      批量制作底层材料汇总与工序树
                    </h4>
                  </div>
                  <div className="flex items-center gap-1.5 text-[12px]">
                    <span className="text-[#5d5f60]">制作次数:</span>
                    {[1, 5, 10, 30].map((num) => (
                      <button
                        key={num}
                        type="button"
                        onClick={() => setCraftCount(num)}
                        className={`h-6 rounded-[4px] px-2 text-[11px] transition-colors num ${
                          craftCount === num
                            ? 'bg-[#1d1f20] text-white'
                            : 'border border-[#e8eaec] bg-[#f4f6f8] text-[#131416] hover:bg-[#ebedee]'
                        }`}
                      >
                        {num}次
                      </button>
                    ))}
                    <input
                      type="number"
                      min={1}
                      max={999}
                      value={craftCount}
                      onChange={(e) =>
                        setCraftCount(
                          Math.max(1, Math.min(999, Number(e.target.value) || 1)),
                        )
                      }
                      className="h-6 w-14 rounded-[4px] border border-[#cdced1] bg-white px-1.5 text-right text-[12px] text-[#131416] focus:border-[#1b6c80] focus:outline-none num"
                    />
                    <span className="text-[#5d5f60] num">
                      (产出{' '}
                      <strong className="text-[#1e7b4f]">
                        {craftCount * currentRecipe.resultAmount}
                      </strong>{' '}
                      个)
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {/* 底层原始材料汇总 */}
                  <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3">
                    <div className="mb-2 text-[11px] font-medium text-[#5d5f60]">
                      底层基础素材总计 (已展开全部半成品)
                    </div>
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {aggregatedMaterials.baseItems.map((mat) => (
                        <button
                          key={mat.itemId}
                          type="button"
                          onClick={() => onSelectItem(mat.itemId)}
                          className="flex items-center justify-between rounded-[5px] border border-[#e8eaec] bg-white px-2.5 py-1.5 text-left text-[12px] transition-colors hover:border-[#cdced1]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <img
                              src={getIconUrl(mat.iconId)}
                              alt={mat.nameCn}
                              className="h-5 w-5 shrink-0 rounded-[3px]"
                            />
                            <span className="truncate text-[#131416]">
                              {mat.nameCn}
                            </span>
                          </div>
                          <span className="ml-2 shrink-0 font-semibold text-[#1b6c80] num">
                            ×{mat.totalAmount}
                          </span>
                        </button>
                      ))}
                      {aggregatedMaterials.crystals.map((cry) => (
                        <button
                          key={cry.itemId}
                          type="button"
                          onClick={() => onSelectItem(cry.itemId)}
                          className="flex items-center justify-between rounded-[5px] border border-[#e8eaec] bg-[#f4f6f8] px-2.5 py-1.5 text-left text-[12px] transition-colors hover:border-[#cdced1]"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <img
                              src={getIconUrl(cry.iconId)}
                              alt={cry.nameCn}
                              className="h-5 w-5 shrink-0 rounded-[3px]"
                            />
                            <span className="truncate text-[#5d5f60]">
                              {cry.nameCn}
                            </span>
                          </div>
                          <span className="ml-2 shrink-0 font-semibold text-[#5d5f60] num">
                            ×{cry.totalAmount}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* 递归制作步骤树 */}
                  <div className="rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3">
                    <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5d5f60]">
                      <GitBranch className="h-3.5 w-3.5 text-[#1b6c80]" />
                      子配方工序分解树
                    </div>
                    <div className="space-y-1.5">
                      {recipeTree.children.map((child) => (
                        <RecipeTreeItemView
                          key={child.itemId}
                          node={child}
                          parentCrafts={craftCount}
                          onSelectItem={onSelectItem}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {/* 2. 作为原料的配方用途 */}
      {usedInRecipes.length > 0 && (
        <section className="rounded-[8px] border border-[#e8eaec] bg-white">
          <div className="flex items-center justify-between border-b border-[#e8eaec] px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-[#1b6c80]" />
              <h3 className="text-[14px] font-semibold text-[#131416]">
                作为原料的下游配方用途
              </h3>
              <span className="pill pill-neutral num">
                {usedInRecipes.length} 项关联配方
              </span>
            </div>
          </div>

          <div className="grid gap-2 p-4 sm:grid-cols-2 lg:grid-cols-3">
            {usedInRecipes.map((usage) => (
              <button
                key={usage.recipeId}
                type="button"
                onClick={() => onSelectItem(usage.resultItemId)}
                className="flex items-center justify-between rounded-[6px] border border-[#e8eaec] bg-white p-2.5 text-left transition-colors hover:border-[#cdced1] hover:bg-[#f9fbfc]"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <img
                    src={getIconUrl(usage.resultIconId)}
                    alt={usage.resultNameCn}
                    className="h-8 w-8 shrink-0 rounded-[5px] border border-[#e8eaec] bg-[#f4f6f8]"
                  />
                  <div className="min-w-0">
                    <div className="truncate text-[12px] font-medium text-[#131416]">
                      {usage.resultNameCn}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1 text-[11px] text-[#5d5f60] num">
                      <img
                        src={getIconUrl(usage.craftJobIconId)}
                        alt={usage.craftJobName}
                        className="h-3 w-3"
                      />
                      <span>
                        {usage.craftJobName} Lv.{usage.recipeLevel}
                        {formatStars(usage.stars)}
                      </span>
                    </div>
                  </div>
                </div>
                <span className="ml-2 shrink-0 pill pill-accent num">
                  需 ×{usage.amountRequired}
                </span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
