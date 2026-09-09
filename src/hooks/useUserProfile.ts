import { useMemo } from "react";
import { useAuth } from "./useAuth";
import { useSupabaseQuery } from "./useSupabaseQuery";

interface Profile {
    id: string;
    firstName: string;
    lastName: string;
}

const TABLE_NAME = "profiles";
const QUERY_KEY = ["user_profile"];

export function useUserProfile() {
    const { user } = useAuth();
    
    // Busca o perfil do usuário logado
    const { data: profiles = [], isLoading } = useSupabaseQuery<Profile>(
        TABLE_NAME,
        QUERY_KEY,
        "first_name, last_name", // Seleciona apenas os campos necessários
        !!user,
        [{ column: 'id', operator: 'eq', value: user?.id }],
        1
    );
    
    const profile = profiles[0];

    const fullName = useMemo(() => {
        if (!profile) return null;
        
        const name = `${profile.firstName || ''} ${profile.lastName || ''}`.trim();
        return name || user?.email || null;
    }, [profile, user?.email]);
    
    return {
        profile,
        fullName,
        isLoading,
    };
}