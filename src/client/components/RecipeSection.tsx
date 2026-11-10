import {
  BookOpen,
  Flame,
  GitBranch,
  Hammer,
  Sparkles,
} from 'lucide-react'
import { useState } from 'react'
import type {
  RecipeDetail,
  RecipeTreeNode,
  UsedInRecipeItem,
} from '../../shared/types'
import { getIconUrl } from '../api'

interface RecipeSectionProps {
  recipes: RecipeDetail[]
  recipeTrees?: RecipeTreeNode[]
  onSelectItem: (itemId: number) => void
}

interface UsedInRecipeSectionProps {
  usedInRecipes: UsedInRecipeItem[]
  onSelectItem: (itemId: number) => void
}

function formatStars(stars: number): string {
  return stars > 0 ? ` · ${stars}星` : ''
}

function CrystalItemView({
  crystal,
  craftsNeeded,
  onSelectItem,
}: {
  crystal: { itemId: number; nameCn: string; iconId: number; amount: number }
  craftsNeeded: number
  onSelectItem: (itemId: number) => void
}) {
  const totalAmount = crystal.amount * craftsNeeded
  return (
    <div
      onClick={() => onSelectItem(crystal.itemId)}
      className="flex cursor-pointer items-center justify-between rounded-[6px] border border-[#e8eaec] bg-[#f4f6f8] px-3 py-1.5 text-[12px] transition-colors hover:border-[#cdced1] hover:bg-[#ebedee]"
    >
      <div className="flex items-center gap-2">
        <img
          src={getIconUrl(crystal.iconId)}
          alt={crystal.nameCn}
          className="h-5 w-5 rounded-[4px] border border-[#e8eaec] bg-white"
        />
        <span className="font-medium text-[#131416]">{crystal.nameCn}</span>
        <span className="pill pill-neutral">
          <Flame className="h-3 w-3 text-[#1b6c80]" />
          水晶媒介
        </span>
      </div>
      <div className="text-[12px] font-semibold text-[#1b6c80] num">
        ×{totalAmount}
      </div>
    </div>
  )
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
  const hasSubItems = node.children.length > 0 || node.crystals.length > 0

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
        </div>
      </div>

      {hasSubItems && (
        <div className="ml-4 space-y-1.5 border-l border-[#e8eaec] pl-3">
          {node.children.map((child) => (
            <RecipeTreeItemView
              key={child.itemId}
              node={child}
              parentCrafts={craftsNeeded}
              onSelectItem={onSelectItem}
            />
          ))}
          {node.crystals.map((cry) => (
            <CrystalItemView
              key={`cry-${cry.itemId}`}
              crystal={cry}
              craftsNeeded={craftsNeeded}
              onSelectItem={onSelectItem}
            />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * 能工巧匠制作配方与子配方工序分解树（含水晶媒介）
 */
export function RecipeSection({
  recipes,
  recipeTrees,
  onSelectItem,
}: RecipeSectionProps) {
  const [activeIdx, setActiveIdx] = useState(0)

  if (recipes.length === 0) {
    return null
  }

  const currentRecipe = recipes[activeIdx] || recipes[0]
  const currentTree =
    recipeTrees && recipeTrees[activeIdx]
      ? recipeTrees[activeIdx]
      : recipeTrees?.[0]

  return (
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
                  Lv.{currentRecipe.recipeLevel}
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

        {/* 子配方工序分解树（含水晶素材） */}
        {currentTree && (
          <div className="mt-4 rounded-[6px] border border-[#e8eaec] bg-[#f9fbfc] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-[11px] font-medium text-[#5d5f60]">
              <GitBranch className="h-3.5 w-3.5 text-[#1b6c80]" />
              子配方工序分解树
            </div>
            <div className="space-y-1.5">
              {currentTree.children.map((child) => (
                <RecipeTreeItemView
                  key={child.itemId}
                  node={child}
                  parentCrafts={1}
                  onSelectItem={onSelectItem}
                />
              ))}
              {currentTree.crystals.map((cry) => (
                <CrystalItemView
                  key={`root-cry-${cry.itemId}`}
                  crystal={cry}
                  craftsNeeded={1}
                  onSelectItem={onSelectItem}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

/**
 * 作为原料的下游配方用途面板（置于大地使者采集点与捕鱼人垂钓钓场下方）
 */
export function UsedInRecipeSection({
  usedInRecipes,
  onSelectItem,
}: UsedInRecipeSectionProps) {
  if (usedInRecipes.length === 0) {
    return null
  }

  return (
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
  )
}
