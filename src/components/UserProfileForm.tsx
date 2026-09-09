import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, User, KeyRound } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { showSuccess, showError } from "@/utils/toast";

const UserProfileForm: React.FC = () => {
    const { user } = useAuth();
    const [firstName, setFirstName] = useState("");
    const [lastName, setLastName] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
    const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

    // Carrega o nome do perfil
    useEffect(() => {
        const fetchProfile = async () => {
            if (user) {
                const { data, error } = await supabase
                    .from('profiles')
                    .select('first_name, last_name')
                    .eq('id', user.id)
                    .single();
                
                if (error && error.code !== 'PGRST116') { // PGRST116 = No rows found
                    console.error("Erro ao buscar perfil:", error);
                } else if (data) {
                    setFirstName(data.first_name || "");
                    setLastName(data.last_name || "");
                }
            }
        };
        fetchProfile();
    }, [user]);

    const handleProfileUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setIsUpdatingProfile(true);
        
        // 1. Atualiza a tabela profiles
        const { error: profileError } = await supabase
            .from('profiles')
            .update({ first_name: firstName, last_name: lastName, updated_at: new Date().toISOString() })
            .eq('id', user.id);

        // 2. Atualiza o user_metadata no auth (opcional, mas bom para consistência)
        const { error: authError } = await supabase.auth.updateUser({
            data: { first_name: firstName, last_name: lastName }
        });

        setIsUpdatingProfile(false);

        if (profileError || authError) {
            showError(`Falha ao atualizar perfil: ${profileError?.message || authError?.message}`);
        } else {
            showSuccess("Perfil atualizado com sucesso!");
        }
    };

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        if (newPassword.length < 6) {
            showError("A nova senha deve ter pelo menos 6 caracteres.");
            return;
        }
        if (newPassword !== confirmPassword) {
            showError("As senhas não coincidem.");
            return;
        }

        setIsUpdatingPassword(true);
        
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });

        setIsUpdatingPassword(false);

        if (error) {
            showError(`Falha ao atualizar senha: ${error.message}`);
        } else {
            showSuccess("Senha atualizada com sucesso! Você pode precisar fazer login novamente.");
            setNewPassword("");
            setConfirmPassword("");
        }
    };

    const fullName = `${firstName} ${lastName}`.trim() || user?.email;

    return (
        <div className="space-y-6">
            {/* Seção de Informações do Usuário */}
            <Card className="bg-sidebar border-sidebar-border">
                <CardHeader>
                    <CardTitle className="text-xl font-bold flex items-center">
                        <User className="w-5 h-5 mr-2 text-sidebar-primary" />
                        Informações do Usuário
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                    <p className="text-lg font-semibold text-sidebar-primary-foreground">{fullName}</p>
                    <p className="text-sm text-gray-400">Email: {user?.email}</p>
                </CardContent>
            </Card>

            {/* Formulário de Edição de Nome */}
            <Card className="bg-sidebar border-sidebar-border">
                <CardHeader>
                    <CardTitle className="text-lg font-bold">Editar Nome</CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleProfileUpdate} className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName">Primeiro Nome</Label>
                                <Input
                                    id="firstName"
                                    value={firstName}
                                    onChange={(e) => setFirstName(e.target.value)}
                                    className="border border-border bg-input"
                                    disabled={isUpdatingProfile}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName">Sobrenome</Label>
                                <Input
                                    id="lastName"
                                    value={lastName}
                                    onChange={(e) => setLastName(e.target.value)}
                                    className="border border-border bg-input"
                                    disabled={isUpdatingProfile}
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isUpdatingProfile || !user} className="w-full md:w-auto bg-blue-600 hover:bg-blue-700">
                            {isUpdatingProfile ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                "Salvar Nome"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Formulário de Edição de Senha */}
            <Card className="bg-sidebar border-sidebar-border">
                <CardHeader>
                    <CardTitle className="text-lg font-bold flex items-center">
                        <KeyRound className="w-5 h-5 mr-2 text-sidebar-primary" />
                        Alterar Senha
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handlePasswordUpdate} className="grid gap-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="newPassword">Nova Senha (mín. 6 caracteres)</Label>
                                <Input
                                    id="newPassword"
                                    type="password"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className="border border-border bg-input"
                                    disabled={isUpdatingPassword}
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="confirmPassword">Repetir Nova Senha</Label>
                                <Input
                                    id="confirmPassword"
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className="border border-border bg-input"
                                    disabled={isUpdatingPassword}
                                    required
                                />
                            </div>
                        </div>
                        <Button type="submit" disabled={isUpdatingPassword || !user || !newPassword || newPassword !== confirmPassword} className="w-full md:w-auto bg-red-600 hover:bg-red-700">
                            {isUpdatingPassword ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                "Alterar Senha"
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default UserProfileForm;