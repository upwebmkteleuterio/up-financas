"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Search, PlusCircle } from "lucide-react";
import { format, subDays } from "date-fns";
import { supabase } from "@/lib/supabase";

interface DescriptionAutocompleteProps {
    value: string;
    onChange: (val: string) => void;
    type: "Entrada" | "Saída";
    category: string;
    activePartners: any[];
    placeholder?: string;
    disabled?: boolean;
    userId?: string;
    onBlur?: (value: string) => void;
    onSuggestionSelect?: (value: string) => void;
}

const DescriptionAutocomplete: React.FC<DescriptionAutocompleteProps> = ({
    value,
    onChange,
    type,
    category,
    activePartners,
    placeholder,
    disabled,
    userId,
    onBlur,
    onSuggestionSelect
}) => {
    const [suggestions, setSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const suggestionRef = useRef<HTMLDivElement>(null);
    const selectingSuggestionRef = useRef(false);

    const fetchSuggestions = useCallback(async (typed: string) => {
        if (!userId || typed.length < 3) {
            setSuggestions([]);
            return;
        }

        setIsLoading(true);
        const dateLimit = format(subDays(new Date(), 60), 'yyyy-MM-dd');

        try {
            const { data, error } = await supabase
                .from('transactions')
                .select('description')
                .eq('user_id', userId)
                .eq('type', type)
                .gte('date', dateLimit)
                .ilike('description', `%${typed}%`)
                .limit(20);

            if (!error && data) {
                let descriptions = data.map(d => d.description);

                if (category === "Saque de Lucro") {
                    descriptions = descriptions.map(desc => {
                        for (const partner of activePartners) {
                            const prefix = `${partner.name} - `;
                            if (desc.startsWith(prefix)) return desc.substring(prefix.length);
                            if (desc === partner.name) return "";
                        }
                        return desc;
                    }).filter(desc => desc.trim() !== "");
                }

                const unique = Array.from(new Set(descriptions))
                    .filter(desc => desc.toLowerCase() !== typed.toLowerCase())
                    .slice(0, 5);
                    
                setSuggestions(unique);
                setShowSuggestions(unique.length > 0);
            }
        } catch (e) {
            console.error("Erro ao buscar sugestões", e);
        } finally {
            setIsLoading(false);
        }
    }, [userId, type, category, activePartners]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (suggestionRef.current && !suggestionRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    return (
        <div className="space-y-2 relative">
            <div className="relative">
                <Input 
                    value={value} 
                    onChange={(e) => {
                        onChange(e.target.value);
                        fetchSuggestions(e.target.value);
                    }} 
                    placeholder={placeholder} 
                    required 
                    className="bg-input" 
                    autoComplete="off"
                    disabled={disabled}
                    onBlur={(event) => {
                        if (selectingSuggestionRef.current) {
                            selectingSuggestionRef.current = false;
                            return;
                        }
                        onBlur?.(event.currentTarget.value);
                    }}
                />
                {isLoading && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        <PlusCircle className="w-4 h-4 animate-spin text-muted-foreground" />
                    </div>
                )}
            </div>

            {showSuggestions && suggestions.length > 0 && !disabled && (
                <div 
                    ref={suggestionRef}
                    className="absolute z-[100] w-full mt-1 bg-card border border-border rounded-md shadow-xl overflow-hidden animate-in fade-in zoom-in-95 duration-100"
                >
                    <div className="p-1 bg-secondary/30 text-[10px] uppercase font-bold text-gray-500 px-3 py-1 flex items-center">
                        <Search className="w-3 h-3 mr-1" /> Sugestões Recentes
                    </div>
                    {suggestions.map((suggestion, idx) => (
                        <button
                            key={idx}
                            type="button"
                            className="w-full text-left px-3 py-2 text-sm hover:bg-sidebar-primary hover:text-sidebar-primary-foreground transition-colors border-b border-border last:border-0"
                            onMouseDown={(event) => {
                                event.preventDefault();
                                selectingSuggestionRef.current = true;
                            }}
                            onClick={() => {
                                onChange(suggestion);
                                onSuggestionSelect?.(suggestion);
                                setShowSuggestions(false);
                            }}
                        >
                            {suggestion}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};

export default DescriptionAutocomplete;