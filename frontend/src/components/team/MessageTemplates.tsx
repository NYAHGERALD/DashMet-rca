'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  X,
  Search,
  Plus,
  Star,
  Trash2,
  Edit2,
  Check,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import api from '@/lib/api';

interface Template {
  id: string;
  name: string;
  category: string;
  content: string;
  isGlobal: boolean;
  usageCount: number;
}

interface MessageTemplatesProps {
  onSelectTemplate: (content: string) => void;
  onClose: () => void;
}

const CATEGORY_ICONS: Record<string, string> = {
  updates: '📊',
  investigation: '🔍',
  actions: '✅',
  escalation: '⚠️',
  handoff: '🔄',
  evidence: '📎',
  meetings: '📅',
  general: '📝',
};

const CATEGORY_COLORS: Record<string, string> = {
  updates: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300',
  investigation: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300',
  actions: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300',
  escalation: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300',
  handoff: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300',
  evidence: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300',
  meetings: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
  general: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-300',
};

export default function MessageTemplates({
  onSelectTemplate,
  onClose,
}: MessageTemplatesProps) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formCategory, setFormCategory] = useState('general');
  const [formContent, setFormContent] = useState('');
  const [formSaving, setFormSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await api.get('/chat/templates');
      setTemplates(response.data?.data || []);
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleSelectTemplate = async (template: Template) => {
    // Track usage
    try {
      await api.post(`/chat/templates/${template.id}/use`);
    } catch (error) {
      // Silently fail - not critical
    }

    onSelectTemplate(template.content);
    onClose();
  };

  const handleCreateTemplate = async () => {
    if (!formName.trim() || !formContent.trim()) {
      setFormError('Name and content are required');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      const response = await api.post('/chat/templates', {
        name: formName,
        category: formCategory,
        content: formContent,
      });

      setTemplates((prev) => [...prev, response.data?.data]);
      setShowCreateForm(false);
      resetForm();
    } catch (error: any) {
      setFormError(error.response?.data?.error || 'Failed to create template');
    } finally {
      setFormSaving(false);
    }
  };

  const handleUpdateTemplate = async () => {
    if (!editingTemplate || !formName.trim() || !formContent.trim()) {
      setFormError('Name and content are required');
      return;
    }

    setFormSaving(true);
    setFormError(null);

    try {
      const response = await api.put(`/chat/templates/${editingTemplate.id}`, {
        name: formName,
        category: formCategory,
        content: formContent,
      });

      setTemplates((prev) =>
        prev.map((t) => (t.id === editingTemplate.id ? response.data?.data : t))
      );
      setEditingTemplate(null);
      resetForm();
    } catch (error: any) {
      setFormError(error.response?.data?.error || 'Failed to update template');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await api.delete(`/chat/templates/${templateId}`);
      setTemplates((prev) => prev.filter((t) => t.id !== templateId));
    } catch (error) {
      console.error('Failed to delete template:', error);
    }
  };

  const startEditing = (template: Template) => {
    setEditingTemplate(template);
    setFormName(template.name);
    setFormCategory(template.category);
    setFormContent(template.content);
    setShowCreateForm(true);
  };

  const resetForm = () => {
    setFormName('');
    setFormCategory('general');
    setFormContent('');
    setFormError(null);
  };

  // Filter templates
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch =
      searchQuery === '' ||
      t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.content.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory =
      selectedCategory === null || t.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Get unique categories
  const categories = [...new Set(templates.map((t) => t.category))];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Message Templates
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded-full"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Create/Edit Form */}
        {showCreateForm && (
          <div className="p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
            <h4 className="font-medium text-gray-900 dark:text-white mb-3">
              {editingTemplate ? 'Edit Template' : 'Create New Template'}
            </h4>
            {formError && (
              <div className="mb-3 p-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded">
                {formError}
              </div>
            )}
            <div className="space-y-3">
              <div className="flex gap-3">
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="Template name"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                />
                <select
                  value={formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  className="px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
                >
                  <option value="general">General</option>
                  <option value="updates">Updates</option>
                  <option value="investigation">Investigation</option>
                  <option value="actions">Actions</option>
                  <option value="escalation">Escalation</option>
                  <option value="handoff">Handoff</option>
                  <option value="evidence">Evidence</option>
                  <option value="meetings">Meetings</option>
                </select>
              </div>
              <textarea
                value={formContent}
                onChange={(e) => setFormContent(e.target.value)}
                placeholder="Template content... Use [placeholder] for variables"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm resize-none"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => {
                    setShowCreateForm(false);
                    setEditingTemplate(null);
                    resetForm();
                  }}
                  className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
                >
                  Cancel
                </button>
                <button
                  onClick={editingTemplate ? handleUpdateTemplate : handleCreateTemplate}
                  disabled={formSaving}
                  className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                >
                  {formSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Check className="w-4 h-4" />
                  )}
                  {editingTemplate ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Search and Filter */}
        <div className="p-4 border-b border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search templates..."
                className="w-full pl-9 pr-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white text-sm"
              />
            </div>
            {!showCreateForm && (
              <button
                onClick={() => {
                  setShowCreateForm(true);
                  setEditingTemplate(null);
                  resetForm();
                }}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                New
              </button>
            )}
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap gap-2 mt-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={`px-3 py-1 text-xs rounded-full transition-colors ${
                selectedCategory === null
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1 text-xs rounded-full transition-colors flex items-center gap-1 ${
                  selectedCategory === cat
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-slate-600'
                }`}
              >
                <span>{CATEGORY_ICONS[cat] || '📝'}</span>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Template List */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
            </div>
          ) : filteredTemplates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="text-gray-500 dark:text-gray-400">
                {searchQuery || selectedCategory
                  ? 'No templates match your filters'
                  : 'No templates yet. Create one to get started!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredTemplates.map((template) => (
                <div
                  key={template.id}
                  className="group p-3 border border-gray-200 dark:border-slate-700 rounded-lg hover:border-blue-300 dark:hover:border-blue-600 hover:bg-blue-50/50 dark:hover:bg-blue-900/10 transition-colors cursor-pointer"
                  onClick={() => handleSelectTemplate(template)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className={`px-2 py-0.5 text-xs rounded-full ${
                            CATEGORY_COLORS[template.category] || CATEGORY_COLORS.general
                          }`}
                        >
                          {CATEGORY_ICONS[template.category] || '📝'} {template.category}
                        </span>
                        {template.isGlobal && (
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                        )}
                        {template.usageCount > 0 && (
                          <span className="text-xs text-gray-400">
                            Used {template.usageCount}x
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {template.name}
                      </h4>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 line-clamp-2">
                        {template.content}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-2">
                      {!template.isGlobal && !template.id.startsWith('default-') && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(template);
                            }}
                            className="p-1.5 hover:bg-gray-200 dark:hover:bg-slate-600 rounded"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4 text-gray-500" />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteTemplate(template.id);
                            }}
                            className="p-1.5 hover:bg-red-100 dark:hover:bg-red-900/30 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </button>
                        </>
                      )}
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            💡 Tip: Use [brackets] for placeholders like [status] or [assignee]
          </p>
        </div>
      </div>
    </div>
  );
}
