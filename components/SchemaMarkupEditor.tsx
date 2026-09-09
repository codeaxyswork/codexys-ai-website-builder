"use client";

import React, { useState, useEffect } from "react";

interface SchemaMarkupEditorProps {
  schemaMarkup: Record<string, any>;
  onChange: (updatedSchema: Record<string, any>) => void;
  canUseSchema: boolean;
}

export function SchemaMarkupEditor({
  schemaMarkup,
  onChange,
  canUseSchema,
}: SchemaMarkupEditorProps) {
  const [activeTab, setActiveTab] = useState<"builder" | "json">("builder");
  const [schemaType, setSchemaType] = useState<string>(
    schemaMarkup["@type"] || "LocalBusiness"
  );
  const [jsonText, setJsonText] = useState<string>(
    JSON.stringify(schemaMarkup, null, 2)
  );
  const [jsonError, setJsonError] = useState<string | null>(null);

  // Form fields state
  const [name, setName] = useState<string>(schemaMarkup.name || "");
  const [description, setDescription] = useState<string>(schemaMarkup.description || "");
  const [telephone, setTelephone] = useState<string>(schemaMarkup.telephone || "");
  const [email, setEmail] = useState<string>(schemaMarkup.email || "");
  const [address, setAddress] = useState<string>(
    typeof schemaMarkup.address === "string"
      ? schemaMarkup.address
      : schemaMarkup.address?.streetAddress || ""
  );
  const [url, setUrl] = useState<string>(schemaMarkup.url || "");
  const [logo, setLogo] = useState<string>(schemaMarkup.logo || "");

  useEffect(() => {
    setJsonText(JSON.stringify(schemaMarkup, null, 2));
    if (schemaMarkup["@type"]) {
      setSchemaType(schemaMarkup["@type"]);
    }
  }, [schemaMarkup]);

  const updateBuilderSchema = (updatedFields: Record<string, any>) => {
    const updated: Record<string, any> = {
      "@context": "https://schema.org",
      "@type": schemaType,
      name,
      description,
      telephone,
      email,
      address,
      url,
      logo,
      ...updatedFields,
    };
    // Remove empty fields
    Object.keys(updated).forEach((k) => {
      if (!updated[k]) delete updated[k];
    });
    setJsonText(JSON.stringify(updated, null, 2));
    onChange(updated);
  };

  const handleTypeChange = (type: string) => {
    setSchemaType(type);
    updateBuilderSchema({ "@type": type });
  };

  const handleJsonChange = (text: string) => {
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      setJsonError(null);
      onChange(parsed);
    } catch (e: any) {
      setJsonError("Invalid JSON syntax.");
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm mb-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-slate-100 pb-4 mb-6 gap-4">
        <div>
          <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <svg className="w-5 h-5 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
            </svg>
            Structured Data Schema Markup (JSON-LD)
          </h3>
          <p className="text-xs text-slate-500 mt-1">
            Provide search engines with structured information for rich snippet results.
          </p>
        </div>

        {!canUseSchema && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold rounded-full">
            ⭐ Pro / Agency Plan Feature
          </span>
        )}

        <div className="flex items-center bg-slate-100 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setActiveTab("builder")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "builder" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Visual Form
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("json")}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
              activeTab === "json" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            Raw JSON-LD
          </button>
        </div>
      </div>

      {activeTab === "builder" ? (
        <div className="space-y-5">
          {/* Schema Type Selector */}
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Schema Entity Type</label>
            <select
              value={schemaType}
              onChange={(e) => handleTypeChange(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="LocalBusiness">Local Business</option>
              <option value="Organization">Organization / Company</option>
              <option value="Service">Service Provider</option>
              <option value="Product">Product</option>
              <option value="Article">Article / Blog</option>
              <option value="WebSite">Generic WebSite</option>
            </select>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Business / Organization Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  updateBuilderSchema({ name: e.target.value });
                }}
                placeholder="e.g. Apex Martial Arts Academy"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Telephone Phone Number</label>
              <input
                type="text"
                value={telephone}
                onChange={(e) => {
                  setTelephone(e.target.value);
                  updateBuilderSchema({ telephone: e.target.value });
                }}
                placeholder="+1 (555) 019-2834"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Contact Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  updateBuilderSchema({ email: e.target.value });
                }}
                placeholder="contact@example.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Street Address / Location</label>
              <input
                type="text"
                value={address}
                onChange={(e) => {
                  setAddress(e.target.value);
                  updateBuilderSchema({ address: e.target.value });
                }}
                placeholder="123 Main St, Suite 400, New York, NY"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Official Website URL</label>
              <input
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  updateBuilderSchema({ url: e.target.value });
                }}
                placeholder="https://example.com"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Logo Image URL</label>
              <input
                type="url"
                value={logo}
                onChange={(e) => {
                  setLogo(e.target.value);
                  updateBuilderSchema({ logo: e.target.value });
                }}
                placeholder="https://example.com/logo.png"
                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                updateBuilderSchema({ description: e.target.value });
              }}
              placeholder="Brief structured description of your business or services."
              className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      ) : (
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-700">Custom JSON-LD Code</label>
            {jsonError && <span className="text-xs font-semibold text-rose-600">{jsonError}</span>}
          </div>
          <textarea
            rows={10}
            value={jsonText}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full p-4 bg-slate-900 text-emerald-400 font-mono text-xs rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>
      )}
    </div>
  );
}
