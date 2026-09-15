"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePlatformAdmin } from "@/lib/auth/platform-admin";
import {
  HOMEPAGE_CATEGORY_IDS,
  HOMEPAGE_SECTION_IDS,
  homepageConfigSchema,
  type HomepageCategoryId,
  type HomepageConfig,
  type HomepageSectionId,
} from "@/lib/domain/homepage-cms";

function text(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function checked(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

function orderedIds<T extends string>(
  ids: readonly T[],
  formData: FormData,
  prefix: string,
): T[] {
  return [...ids].sort((a, b) => {
    const left = Number(formData.get(`${prefix}.${a}`));
    const right = Number(formData.get(`${prefix}.${b}`));
    return (Number.isFinite(left) ? left : 99) - (Number.isFinite(right) ? right : 99);
  });
}

function selectedIdsInOrder(
  formData: FormData,
  selectedName: string,
  orderPrefix: string,
): string[] {
  return formData
    .getAll(selectedName)
    .map(String)
    .sort((a, b) => {
      const left = Number(formData.get(`${orderPrefix}.${a}`));
      const right = Number(formData.get(`${orderPrefix}.${b}`));
      return (Number.isFinite(left) ? left : 99) - (Number.isFinite(right) ? right : 99);
    });
}

function configFromForm(formData: FormData): HomepageConfig {
  const categories = orderedIds<HomepageCategoryId>(
    HOMEPAGE_CATEGORY_IDS,
    formData,
    "categoryOrder",
  ).map((id) => ({
    id,
    enabled: checked(formData, `category.${id}.enabled`),
    title: text(formData, `category.${id}.title`),
    subtitle: text(formData, `category.${id}.subtitle`),
    imageUrl: text(formData, `category.${id}.imageUrl`),
    href: text(formData, `category.${id}.href`),
  }));

  const popularSearches = text(formData, "search.popularSearches")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 8)
    .map((line) => {
      const [label, ...queryParts] = line.split("|");
      return {
        label: label.trim(),
        query: (queryParts.join("|").trim() || label).trim(),
      };
    });

  const raw: HomepageConfig = {
    hero: {
      enabled: checked(formData, "hero.enabled"),
      eyebrow: text(formData, "hero.eyebrow"),
      headline: text(formData, "hero.headline"),
      description: text(formData, "hero.description"),
      imageUrl: text(formData, "hero.imageUrl"),
      primaryCtaEnabled: checked(formData, "hero.primaryCtaEnabled"),
      primaryCtaLabel: text(formData, "hero.primaryCtaLabel"),
      primaryCtaHref: text(formData, "hero.primaryCtaHref"),
      secondaryCtaEnabled: checked(formData, "hero.secondaryCtaEnabled"),
      secondaryCtaLabel: text(formData, "hero.secondaryCtaLabel"),
      secondaryCtaHref: text(formData, "hero.secondaryCtaHref"),
    },
    search: {
      enabled: checked(formData, "search.enabled"),
      heading: text(formData, "search.heading"),
      placeholder: text(formData, "search.placeholder"),
      defaultAreaLabel: text(formData, "search.defaultAreaLabel"),
      defaultAreaSlug: text(formData, "search.defaultAreaSlug"),
      popularSearches,
    },
    categories,
    recommended: {
      enabled: checked(formData, "recommended.enabled"),
      title: text(formData, "recommended.title"),
      subtitle: text(formData, "recommended.subtitle"),
      useAutomaticSelection: checked(formData, "recommended.useAutomaticSelection"),
      placeIds: selectedIdsInOrder(
        formData,
        "recommended.placeIds",
        "recommended.order",
      ),
    },
    agents: {
      enabled: checked(formData, "agents.enabled"),
      title: text(formData, "agents.title"),
      subtitle: text(formData, "agents.subtitle"),
      useAutomaticSelection: checked(formData, "agents.useAutomaticSelection"),
      businessIds: selectedIdsInOrder(
        formData,
        "agents.businessIds",
        "agents.order",
      ),
    },
    sectionOrder: orderedIds<HomepageSectionId>(
      HOMEPAGE_SECTION_IDS,
      formData,
      "sectionOrder",
    ),
  };

  return homepageConfigSchema.parse(raw);
}

export async function saveHomepageDraftAction(formData: FormData): Promise<void> {
  let error: string | null = null;
  try {
    const ctx = await requirePlatformAdmin();
    await ctx.store.saveHomepageDraft(ctx.actor, configFromForm(formData));
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "บันทึกร่างไม่สำเร็จ";
  }
  if (error) {
    redirect(`/admin/website?error=${encodeURIComponent(error)}`);
  }
  revalidatePath("/admin/website");
  revalidatePath("/admin/website/preview");
  redirect("/admin/website?saved=1");
}

export async function publishHomepageDraftAction(): Promise<void> {
  const ctx = await requirePlatformAdmin();
  await ctx.store.publishHomepageDraft(ctx.actor);
  revalidatePath("/");
  revalidatePath("/admin/website");
  revalidatePath("/admin/website/preview");
  redirect("/admin/website?published=1");
}
