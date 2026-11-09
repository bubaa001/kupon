'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ImagePlus,
  Info,
  Plus,
  UtensilsCrossed,
  X,
  Zap,
} from 'lucide-react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  FOOD_CATEGORIES,
  FOOD_CATEGORY_MAX,
  FOOD_DESCRIPTION_MAX,
  FOOD_IMAGE_URL_MAX,
  FOOD_NAME_MAX,
  FOOD_PRICE_MAX,
  FOOD_PRICE_MIN,
  FOOD_QUICK_PRICES,
  FoodPhotoPicker,
  FoodPreviewPanel,
  isValidFoodImageUrl,
  type FoodProduct,
} from '@/components/food';
import { patchJson, postJson } from '@/lib/client-api';
import { cn, formatNumber, formatTZS } from '@/lib/utils';
import type { MenuItemRow } from '../_lib/types';

const DEFAULT_CATEGORY = 'Main';

export function MenuItemDialog({
  open,
  onOpenChange,
  item,
  onSaved,
  apiPath = '/api/vendor/menu',
  audience = 'vendor',
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuItemRow | null;
  onSaved: (message: string) => void;
  apiPath?: string;
  audience?: 'vendor' | 'staff';
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState<string>(DEFAULT_CATEGORY);
  const [customCategory, setCustomCategory] = useState('');
  const [categoryMode, setCategoryMode] = useState<'preset' | 'custom'>('preset');
  const [description, setDescription] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [previewQty, setPreviewQty] = useState(0);
  const [saving, setSaving] = useState(false);
  const [attempted, setAttempted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const customCategoryRef = useRef<HTMLInputElement>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const priceInputRef = useRef<HTMLInputElement>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);
  const serverErrorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const itemCategory = item?.category?.trim() ?? '';
    const categoryIsPreset = (FOOD_CATEGORIES as readonly string[]).includes(itemCategory);

    setName(item?.name ?? '');
    setPrice(item ? String(item.price) : '');
    setCategory(categoryIsPreset ? itemCategory : DEFAULT_CATEGORY);
    setCustomCategory(categoryIsPreset ? '' : itemCategory);
    setCategoryMode(!itemCategory || categoryIsPreset ? 'preset' : 'custom');
    setDescription(item?.description ?? '');
    setImageUrl(item?.imageUrl ?? '');
    setPreviewQty(0);
    setSaving(false);
    setAttempted(false);
    setTouched({});
    setFormError(null);
  }, [open, item]);

  useEffect(() => {
    if (!open || categoryMode !== 'custom') return;
    const timer = window.setTimeout(() => customCategoryRef.current?.focus(), 60);
    return () => window.clearTimeout(timer);
  }, [open, categoryMode]);

  const trimmedName = name.trim();
  const trimmedImageUrl = imageUrl.trim();
  const parsedPrice = Number(price);
  const priceTouched = Boolean(touched.price) || attempted;
  const nameTouched = Boolean(touched.name) || attempted;

  const nameValid = trimmedName.length >= 2 && trimmedName.length <= FOOD_NAME_MAX;
  const priceValid =
    price.trim() !== '' &&
    Number.isInteger(parsedPrice) &&
    parsedPrice >= FOOD_PRICE_MIN &&
    parsedPrice <= FOOD_PRICE_MAX;
  const categoryValue = categoryMode === 'custom' ? customCategory.trim() : category;
  const categoryValid = categoryValue.length >= 2 && categoryValue.length <= FOOD_CATEGORY_MAX;
  const descriptionValid = description.length <= FOOD_DESCRIPTION_MAX;
  const imageValid =
    trimmedImageUrl.length > 0 &&
    trimmedImageUrl.length <= FOOD_IMAGE_URL_MAX &&
    isValidFoodImageUrl(trimmedImageUrl);
  const formValid = nameValid && priceValid && categoryValid && descriptionValid && imageValid;

  const previewItem: FoodProduct = {
    name: trimmedName || 'Your dish name',
    description: description.trim() || '',
    price: priceValid ? parsedPrice : 0,
    category: categoryValue || DEFAULT_CATEGORY,
    imageUrl: trimmedImageUrl || null,
    available: item?.available ?? false,
  };

  function markTouched(field: string) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  function chooseCategory(next: string) {
    setCategoryMode('preset');
    setCategory(next);
    markTouched('category');
  }

  function useCustomCategory() {
    setCategoryMode('custom');
    markTouched('category');
  }

  const invalidFields = [
    !nameValid
      ? { key: 'name', label: 'Dish name', hint: 'Add at least 2 letters.', focus: () => nameInputRef.current?.focus() }
      : null,
    !priceValid
      ? {
          key: 'price',
          label: 'Price',
          hint: `Enter a price between ${formatTZS(FOOD_PRICE_MIN)} and ${formatTZS(FOOD_PRICE_MAX)}.`,
          focus: () => priceInputRef.current?.focus(),
        }
      : null,
    !categoryValid
      ? {
          key: 'category',
          label: 'Category',
          hint: 'Add at least 2 letters.',
          focus: () => customCategoryRef.current?.focus(),
        }
      : null,
    !imageValid
      ? {
          key: 'image',
          label: 'Dish photo',
          hint: 'Upload a JPG, PNG or WebP photo (max 5 MB). A photo is required.',
          focus: () => document.querySelector<HTMLButtonElement>('[data-photo-upload]')?.focus(),
        }
      : null,
  ].filter((field): field is { key: string; label: string; hint: string; focus: () => void } =>
    field !== null,
  );

  async function submit() {
    setAttempted(true);
    setFormError(null);
    if (!formValid) {
      window.requestAnimationFrame(() => errorSummaryRef.current?.focus());
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        price: parsedPrice,
        category: categoryValue,
        description: description.trim(),
        imageUrl: trimmedImageUrl || null,
      };

      if (item) {
        await patchJson(`${apiPath}/${item.id}`, payload);
        onSaved(
          audience === 'staff'
            ? 'Dish details updated.'
            : 'Dish details updated. Staff still control today’s availability.',
        );
      } else {
        await postJson(apiPath, payload);
        onSaved(
          audience === 'staff'
            ? 'Dish added to the menu and available to students.'
            : 'Dish added. It will be available to students after staff mark it in stock.',
        );
      }
      onOpenChange(false);
    } catch (cause) {
      setFormError(
        cause instanceof Error && cause.message
          ? cause.message
          : 'We could not save this dish. Please try again.',
      );
      window.requestAnimationFrame(() => serverErrorRef.current?.focus());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!saving) onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-1rem)] max-w-3xl gap-0 overflow-hidden p-0 sm:max-h-[92dvh] [&>button]:hidden">
        <div className="flex max-h-[92dvh] min-h-0 flex-col">
        <DialogHeader className="shrink-0 gap-0 border-b border-amber-900/10 bg-[#FFFDF7] px-5 py-3.5 pr-14 sm:px-6 sm:py-4">
          <p className="eyebrow mb-1 text-amber-800/60">
            Menu · {item ? 'Edit dish' : 'New dish'}
          </p>
          <DialogTitle className="text-xl">
            {item ? 'Edit your dish' : 'Add a new dish'}
          </DialogTitle>
          <DialogDescription className="mt-0.5 text-[11px] leading-relaxed sm:text-xs">
            {item
              ? audience === 'staff'
                ? 'Update the food, price or photo. Change its stock status from the menu board.'
                : 'Update the dish details here. Staff manage its availability each day.'
              : audience === 'staff'
                ? 'Add food being served at the cafeteria, including its price and photo.'
                : 'Add the dish details here. Staff will mark it in stock when it is available to serve.'}
          </DialogDescription>

          <DialogClose asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Close"
              className="absolute right-3.5 top-3.5 text-slate-400 hover:bg-amber-100/70 hover:text-slate-700 sm:right-4"
            >
              <X className="h-4 w-4" aria-hidden />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="min-h-0 flex-1 touch-pan-y overflow-y-auto overscroll-y-contain [-webkit-overflow-scrolling:touch]">
        <div className="grid gap-5 px-5 py-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_270px] lg:gap-6">
          <div className="order-2 min-w-0 space-y-6 lg:order-1">
            {formError ? (
              <div
                ref={serverErrorRef}
                tabIndex={-1}
                className="rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-red-400"
              >
                <Alert variant="danger" title="Could not save this dish">
                  {formError}
                </Alert>
              </div>
            ) : null}

            {attempted && !formValid ? (
              <div
                ref={errorSummaryRef}
                tabIndex={-1}
                role="alert"
                aria-labelledby="menu-error-summary-title"
                className="rounded-xl border border-red-200 bg-red-50 p-3 outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2"
              >
                <p
                  id="menu-error-summary-title"
                  className="flex items-center gap-1.5 text-[11.5px] font-semibold text-red-800"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  Check these before saving
                </p>
                <ul className="mt-1.5 space-y-1">
                  {invalidFields.map((field) => (
                    <li key={field.key} className="flex items-start gap-1.5 text-[10.5px]">
                      <button
                        type="button"
                        onClick={field.focus}
                        className="shrink-0 font-semibold text-red-800 underline decoration-red-300 underline-offset-2 hover:decoration-red-500"
                      >
                        {field.label}
                      </button>
                      <span className="text-red-700/80">— {field.hint}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <FormSection icon={UtensilsCrossed} title="The dish" hint="Required">
              <div className="space-y-3.5">
                <div className="space-y-1.5">
                  <Label htmlFor="menu-name">
                    Dish name <span className="font-normal text-slate-400">(required)</span>
                  </Label>
                  <Input
                    ref={nameInputRef}
                    id="menu-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    onBlur={() => markTouched('name')}
                    placeholder="e.g. Ugali & Nyama"
                    maxLength={FOOD_NAME_MAX}
                    autoFocus
                    autoComplete="off"
                    error={nameTouched && !nameValid}
                    aria-describedby={nameTouched && !nameValid ? 'menu-name-error' : undefined}
                    className="h-12 text-base font-medium"
                  />
                  {nameTouched && !nameValid ? (
                    <FieldError id="menu-name-error">
                      Give the dish a name with at least 2 letters.
                    </FieldError>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      Write it the way students say it — e.g. &ldquo;Chips Mayai&rdquo;.
                    </p>
                  )}
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <Label htmlFor="menu-price">
                      Price <span className="font-normal text-slate-400">(TZS)</span>
                    </Label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-emerald-700">
                        TZS
                      </span>
                      <Input
                        ref={priceInputRef}
                        id="menu-price"
                        type="text"
                        inputMode="numeric"
                        autoComplete="off"
                        value={price}
                        onChange={(event) =>
                          setPrice(event.target.value.replace(/[^\d]/g, '').slice(0, 6))
                        }
                        onBlur={() => markTouched('price')}
                        placeholder="3000"
                        maxLength={6}
                        error={priceTouched && !priceValid}
                        aria-describedby={
                          priceTouched && !priceValid ? 'menu-price-error' : 'menu-price-hint'
                        }
                        className="h-12 pl-[3.1rem] pr-3 text-base font-semibold tabular"
                      />
                    </div>
                    {priceTouched && !priceValid ? (
                      <FieldError id="menu-price-error">
                        Enter a whole number between {formatTZS(FOOD_PRICE_MIN)} and{' '}
                        {formatTZS(FOOD_PRICE_MAX)}.
                      </FieldError>
                    ) : (
                      <p id="menu-price-hint" className="text-[10px] text-slate-400">
                        {priceValid
                          ? `Students pay ${formatTZS(parsedPrice)}.`
                          : `Between ${formatTZS(FOOD_PRICE_MIN)} and ${formatTZS(FOOD_PRICE_MAX)}.`}
                      </p>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      <span className="self-center text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                        Quick
                      </span>
                      {FOOD_QUICK_PRICES.map((quickPrice) => (
                        <button
                          key={quickPrice}
                          type="button"
                          onClick={() => {
                            setPrice(String(quickPrice));
                            markTouched('price');
                          }}
                          aria-pressed={price === String(quickPrice)}
                          className={cn(
                            'min-h-[36px] rounded-full border px-2 text-[10px] font-semibold tabular transition-colors',
                            price === String(quickPrice)
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                              : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/60',
                          )}
                        >
                          {formatNumber(quickPrice)}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label id="menu-category-label">Category</Label>
                    <div
                      role="group"
                      aria-labelledby="menu-category-label"
                      className="flex flex-wrap gap-1.5"
                    >
                      {FOOD_CATEGORIES.map((option) => {
                        const active = categoryMode === 'preset' && category === option;
                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => chooseCategory(option)}
                            aria-pressed={active}
                            className={cn(
                              'min-h-[36px] rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                              active
                                ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300 hover:bg-amber-50/60',
                            )}
                          >
                            {option}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={useCustomCategory}
                        aria-pressed={categoryMode === 'custom'}
                        className={cn(
                          'inline-flex min-h-[36px] items-center gap-1 rounded-full border px-2.5 text-[11px] font-semibold transition-colors',
                          categoryMode === 'custom'
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-1 ring-emerald-200'
                            : 'border-dashed border-slate-300 bg-white text-slate-500 hover:border-emerald-300 hover:text-emerald-700',
                        )}
                      >
                        <Plus className="h-3 w-3" aria-hidden />
                        Custom
                      </button>
                    </div>

                    {categoryMode === 'custom' ? (
                      <div className="space-y-1">
                        <Input
                          ref={customCategoryRef}
                          value={customCategory}
                          onChange={(event) => setCustomCategory(event.target.value)}
                          onBlur={() => markTouched('category')}
                          placeholder="e.g. Breakfast, Grill, Mama's special"
                          maxLength={FOOD_CATEGORY_MAX}
                          aria-label="Custom category"
                          error={Boolean(touched.category) && !categoryValid}
                          className="h-10 text-sm"
                        />
                        {Boolean(touched.category) && !categoryValid ? (
                          <FieldError>Custom category needs at least 2 letters.</FieldError>
                        ) : null}
                      </div>
                    ) : (
                      <p className="text-[10px] text-slate-400">
                        Categories group your menu into easy chips for students.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </FormSection>

            <FormSection icon={ImagePlus} title="Add a real food photo" hint="Required">
              <FoodPhotoPicker
                imageUrl={imageUrl}
                onImageChange={setImageUrl}
                name={trimmedName}
                error={
                  !imageValid
                    ? 'Upload a JPG, PNG or WebP photo (max 5 MB), or paste an https:// image link.'
                    : undefined
                }
              />
            </FormSection>

            <FormSection icon={CalendarDays} title="Dish details" hint="Optional">
              <div className="space-y-1.5">
                <Label htmlFor="menu-description">
                  Description{' '}
                  <span className="font-normal text-slate-400">
                    ({description.length}/{FOOD_DESCRIPTION_MAX})
                  </span>
                </Label>
                <Textarea
                  id="menu-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value.slice(0, FOOD_DESCRIPTION_MAX))}
                  maxLength={FOOD_DESCRIPTION_MAX}
                  placeholder="What comes with it? e.g. Served with mchicha and two chapatis"
                  className="min-h-[76px] resize-none"
                />
                <p className="text-[10px] text-slate-400">
                  One short line is enough. It shows under the dish name on the menu.
                </p>
              </div>

              <div className="flex gap-2.5 rounded-xl border border-emerald-200/70 bg-emerald-50/70 p-3">
                <Zap className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                <div className="text-[11px] leading-relaxed text-emerald-900">
                  <p className="font-semibold">
                    {audience === 'staff' ? 'You control today’s food and stock' : 'Staff controls daily availability'}
                  </p>
                  <p className="mt-0.5 text-emerald-800/80">
                    {audience === 'staff'
                      ? 'Food you add is available to students immediately. Mark it unavailable when it sells out.'
                      : 'Your dish and price are saved to the cafeteria menu. Staff mark it available when it is in stock and unavailable when it is not.'}
                  </p>
                </div>
              </div>
            </FormSection>
          </div>

          <aside className="order-1 min-w-0 lg:order-2">
            <div className="space-y-3 lg:sticky lg:top-3">
              <FoodPreviewPanel
                item={previewItem}
                quantity={previewQty}
                onAdd={() => setPreviewQty((current) => Math.min(10, current + 1))}
                onRemove={() => setPreviewQty((current) => Math.max(0, current - 1))}
              />
              <div className="hidden rounded-xl border border-slate-200 bg-white p-3 lg:block">
                <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <Info className="h-3 w-3" aria-hidden />
                  Fast add checklist
                </p>
                <ul className="mt-1.5 space-y-1 text-[10.5px] leading-relaxed text-slate-500">
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn(
                        'h-3 w-3 shrink-0',
                        nameValid ? 'text-emerald-500' : 'text-slate-300',
                      )}
                      aria-hidden
                    />
                    A name students recognise
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn(
                        'h-3 w-3 shrink-0',
                        priceValid ? 'text-emerald-500' : 'text-slate-300',
                      )}
                      aria-hidden
                    />
                    The price in TZS
                  </li>
                  <li className="flex items-center gap-1.5">
                    <CheckCircle2
                      className={cn(
                        'h-3 w-3 shrink-0',
                        trimmedImageUrl ? 'text-emerald-500' : 'text-slate-300',
                      )}
                      aria-hidden
                    />
                    Tap a photo (optional)
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
        </div>

        <div className="shrink-0 border-t border-amber-900/10 bg-[#FFFDF7] px-5 py-3 sm:px-6">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
            <p
              className="flex items-center gap-1.5 text-[11px] font-medium text-slate-500"
              aria-live="polite"
            >
              {formValid ? (
                <>
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden />
                  Looks good — ready to {item ? 'save' : 'add'}.
                </>
              ) : (
                <>
                  <Info className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-hidden />
                  Add a name and a price to continue.
                </>
              )}
            </p>
            <div className="flex gap-2">
              <DialogClose asChild>
                <Button
                  type="button"
                  variant="outline"
                  disabled={saving}
                  className="flex-1 sm:flex-none"
                >
                  Cancel
                </Button>
              </DialogClose>
              <Button
                type="button"
                onClick={() => void submit()}
                loading={saving}
                className="flex-1 shadow-emerald-glow sm:flex-none"
              >
                {item ? 'Save changes' : 'Add to menu'}
              </Button>
            </div>
          </div>
        </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function FormSection({
  icon: Icon,
  title,
  hint,
  children,
}: {
  icon: typeof UtensilsCrossed;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100">
          <Icon className="h-3.5 w-3.5" aria-hidden />
        </span>
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
          {title}
        </h3>
        <span className="ml-auto text-[10px] font-medium text-slate-400">{hint}</span>
      </div>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function FieldError({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <p id={id} className="text-[10px] font-medium text-red-600" role="alert">
      {children}
    </p>
  );
}
