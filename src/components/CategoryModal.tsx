import React, { useState, useEffect } from 'react';
import { X, FolderPlus, Check, EyeOff, Trash2, Settings2 } from 'lucide-react';
import { Category } from '../types';
import { AVAILABLE_COLORS, AVAILABLE_ICONS } from '../constants';
import { CategoryIcon } from './CategoryIcon';

interface CategoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (category: Omit<Category, 'id' | 'createdAt'> & { id?: string }) => Promise<void>;
  existingCategories: Category[];
  categoryToEdit?: Category | null;
  onDeleteCategory?: (slug: string) => Promise<void>;
  onRequestDeleteCategory?: (category: Category) => void;
}

export const CategoryModal: React.FC<CategoryModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingCategories,
  categoryToEdit,
  onDeleteCategory,
  onRequestDeleteCategory,
}) => {
  const isEditing = Boolean(categoryToEdit);
  const [name, setName] = useState('');
  const [color, setColor] = useState(AVAILABLE_COLORS[0].hex);
  const [icon, setIcon] = useState(AVAILABLE_ICONS[0]);
  const [description, setDescription] = useState('');
  const [hideFromAll, setHideFromAll] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (categoryToEdit) {
        setName(categoryToEdit.name);
        setColor(categoryToEdit.color);
        setIcon(categoryToEdit.icon);
        setDescription(categoryToEdit.description || '');
        setHideFromAll(Boolean(categoryToEdit.hideFromAll));
      } else {
        setName('');
        setColor(AVAILABLE_COLORS[0].hex);
        setIcon(AVAILABLE_ICONS[0]);
        setDescription('');
        setHideFromAll(false);
      }
      setError(null);
    }
  }, [isOpen, categoryToEdit]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      setError('Category name cannot be empty');
      return;
    }

    const slug = isEditing && categoryToEdit
      ? categoryToEdit.slug
      : cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    if (!isEditing && existingCategories.some((c) => c.slug === slug)) {
      setError('A category with this name or slug already exists');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await onSave({
        name: cleanName,
        slug,
        color,
        icon,
        description: description.trim(),
        isDefault: isEditing ? categoryToEdit?.isDefault : false,
        hideFromAll,
        ...(isEditing && categoryToEdit ? { id: categoryToEdit.id } : {}),
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!categoryToEdit) return;
    if (categoryToEdit.isDefault) {
      setError('Default system categories cannot be deleted');
      return;
    }
    if (onRequestDeleteCategory) {
      onClose();
      onRequestDeleteCategory(categoryToEdit);
      return;
    }
    if (onDeleteCategory) {
      onDeleteCategory(categoryToEdit.slug);
      onClose();
    }
  };

  return (
    <div
      id="category-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        id="category-modal-container"
        className="bg-white dark:bg-[#0D1422] rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800/80 bg-slate-50/50 dark:bg-[#111B2E]/60">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center border ${
              isEditing ? 'bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-cyan-400 border-blue-100 dark:border-blue-900/40' : 'bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900/40'
            }`}>
              {isEditing ? <Settings2 className="w-5 h-5" /> : <FolderPlus className="w-5 h-5" />}
            </div>
            <div>
              <h2 className="text-base font-bold text-[#0F172A] dark:text-[#F1F5F9] font-['Space_Grotesk']">
                {isEditing ? `Edit Category: ${categoryToEdit?.name}` : 'Add New Category'}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {isEditing ? 'Update category appearance and privacy' : 'Custom classification for your saved links'}
              </p>
            </div>
          </div>
          <button
            id="close-category-modal-btn"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 dark:text-slate-200 hover:text-slate-600 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-[#111B2E] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto bg-white dark:bg-[#0D1422]">
          {error && (
            <div className="p-3 text-xs rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="cat-name-input" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Category Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="cat-name-input"
              type="text"
              placeholder="e.g. Finances, Health, Gaming, Recipes"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14] placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Color Badge</label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_COLORS.map((c) => (
                <button
                  key={c.hex}
                  type="button"
                  id={`cat-color-${c.name.toLowerCase()}-btn`}
                  onClick={() => setColor(c.hex)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center transition-all cursor-pointer ${
                    color === c.hex
                      ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-cyan-400 scale-110'
                      : 'hover:scale-105'
                  }`}
                  style={{ backgroundColor: c.hex }}
                >
                  {color === c.hex && <Check className="w-3.5 h-3.5 text-white" />}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-200">Icon</label>
            <div className="grid grid-cols-7 gap-1.5 p-2 border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-[#111B2E]/40">
              {AVAILABLE_ICONS.map((iconName) => {
                const isSelected = icon === iconName;
                return (
                  <button
                    key={iconName}
                    type="button"
                    id={`cat-icon-${iconName}-btn`}
                    onClick={() => setIcon(iconName)}
                    className={`p-2 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-white dark:bg-[#070B14] shadow-xs border border-slate-300 dark:border-cyan-400/50 ring-1 ring-cyan-400/30'
                        : 'hover:bg-slate-200/60 dark:hover:bg-slate-800/80'
                    }`}
                  >
                    <CategoryIcon
                      name={iconName}
                      color={isSelected ? color : '#64748b'}
                      className="w-4 h-4"
                    />
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="cat-desc-input" className="text-xs font-semibold text-slate-700 dark:text-slate-200">
              Description (optional)
            </label>
            <input
              id="cat-desc-input"
              type="text"
              placeholder="Brief summary of what goes in this category"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 dark:border-slate-700 rounded-xl focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 dark:focus:border-cyan-400 text-[#0F172A] dark:text-[#F1F5F9] bg-white dark:bg-[#070B14] placeholder-slate-400 dark:placeholder-slate-500"
            />
          </div>

          {/* Privacy Option (Hide from 'All Links') */}
          <div
            id="cat-privacy-toggle-container"
            onClick={() => setHideFromAll(!hideFromAll)}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
              hideFromAll
                ? 'bg-blue-50/80 dark:bg-blue-950/40 border-blue-200 dark:border-blue-900/60 ring-1 ring-blue-300/60 dark:ring-blue-800/40'
                : 'bg-slate-50 dark:bg-[#111B2E]/40 border-slate-200 dark:border-slate-800 hover:bg-slate-100/70 dark:hover:bg-[#111B2E]/80'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <div
                  className={`p-2 rounded-lg shrink-0 mt-0.5 ${
                    hideFromAll ? 'bg-blue-600 dark:bg-cyan-500 text-white dark:text-slate-950' : 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  <EyeOff className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-800 dark:text-slate-200">
                      Private Category
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                        hideFromAll
                          ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-cyan-300 border border-blue-200 dark:border-blue-800'
                          : 'bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {hideFromAll ? 'Hidden from All Links' : 'Visible in All Links'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">
                    Don't show links from this category on the <strong>"All Links"</strong> page. They will only be visible when you specifically open this category.
                  </p>
                </div>
              </div>
              <input
                type="checkbox"
                id="cat-hide-from-all-checkbox"
                checked={hideFromAll}
                onChange={(e) => setHideFromAll(e.target.checked)}
                className="w-4 h-4 mt-1 accent-blue-600 rounded cursor-pointer shrink-0"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>

          {/* Preview banner */}
          <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#111B2E]/40 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: `${color}20` }}
              >
                <CategoryIcon name={icon} color={color} className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <span>{name.trim() || 'Category Preview'}</span>
                  {hideFromAll && (
                    <EyeOff className="w-3 h-3 text-blue-600 dark:text-cyan-400" title="Private category" />
                  )}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {description.trim() || 'No description provided'}
                </div>
              </div>
            </div>
            {hideFromAll && (
              <span className="text-[10px] font-medium text-blue-600 dark:text-cyan-400 bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 px-2 py-0.5 rounded-md">
                Private
              </span>
            )}
          </div>

          <div className="pt-2 flex items-center justify-between gap-2 border-t border-slate-100 dark:border-slate-800/80">
            {isEditing && !categoryToEdit?.isDefault && (onRequestDeleteCategory || onDeleteCategory) ? (
              <button
                type="button"
                id="delete-category-btn"
                disabled={deleting || saving}
                onClick={handleDelete}
                className="px-3.5 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 bg-rose-50/80 dark:bg-rose-950/40 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200/80 dark:border-rose-900/60 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title={`Delete "${categoryToEdit?.name}" (Requires App Lock PIN + Forgot Password Security Answer)`}
              >
                <Trash2 className="w-3.5 h-3.5 text-slate-400 dark:text-slate-200" />
                <span>Delete Category</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                type="button"
                id="cancel-category-btn"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-[#111B2E] rounded-xl transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                id="submit-category-btn"
                disabled={saving || deleting}
                className="px-5 py-2 text-xs font-semibold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-xl transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
              >
                {saving
                  ? isEditing
                    ? 'Saving...'
                    : 'Creating...'
                  : isEditing
                  ? 'Save Changes'
                  : 'Create Category'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

