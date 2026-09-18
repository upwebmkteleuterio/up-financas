import Layout from "@/components/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle } from "lucide-react";
import React from "react";
import UserProfileForm from "@/components/UserProfileForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MonthlyGoalSettings from "@/components/MonthlyGoalSettings";

const Configuracoes = () => {
  return (
    <Layout 
        pageTitle="Configurações" 
        pageSubtitle="Gerenciamento de dados e configurações gerais da aplicação."
    >
      <div className="space-y-6">
        {/* Header - Visível apenas em telas maiores (lg:flex) */}
        <div className="hidden lg:flex flex-col">
            <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
            Configurações
            </h1>
            <p className="text-gray-400 mt-1">
            Gerenciamento de dados e configurações gerais da aplicação.
            </p>
        </div>

        <Tabs defaultValue="meus-dados" className="w-full">
            <TabsList className="bg-sidebar-accent/50">
                <TabsTrigger value="meus-dados">Meus Dados</TabsTrigger>
            </TabsList>
            
            <TabsContent value="meus-dados" className="mt-6">
                {/* Seção de Perfil e Senha */}
                <UserProfileForm />

                <div className="mt-6">
                    <MonthlyGoalSettings />
                </div>
                
                <Separator className="bg-sidebar-border my-6" />

                {/* Seção de Ferramentas de Dados (Removida) */}
                <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold">
                            Ferramentas de Dados
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        <p className="text-gray-500">
                            Nenhuma ferramenta de dados avançada configurada.
                        </p>
                    </CardContent>
                </Card>
            </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Configuracoes;