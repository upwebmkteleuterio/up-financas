import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useExpenseCategories } from "@/hooks/useExpenseCategories";
import { DollarSign, ClipboardList, Tag } from "lucide-react";
import React from "react";
import ExpenseCategoryManagementContent from "@/components/ExpenseCategoryManagementContent"; // Importando o conteúdo
import FloatingActionButton from "@/components/FloatingActionButton";
import { useIsMobile } from "@/hooks/use-mobile";

const GestaoDeGastos = () => {
  const { expenseCategories } = useExpenseCategories();
  const isMobile = useIsMobile();
  
  // O FAB no mobile deve abrir o modal de transação de saída, mas aqui não temos um FAB para esta página.
  // Se o usuário quiser adicionar uma categoria, ele deve usar o formulário inline.
  
  return (
    <Layout 
        pageTitle="Gestão de Gastos" 
        pageSubtitle="Cadastre e gerencie categorias de gastos variáveis."
    >
      <div className="space-y-6">
        {/* Header - Visível apenas em telas maiores (lg:flex) */}
        <div className="hidden lg:flex flex-col">
          <h1 className="text-3xl font-bold text-sidebar-primary-foreground">
            Gestão de Categorias de Gastos
          </h1>
          <p className="text-gray-400 mt-1">
            Cadastre e gerencie categorias de gastos variáveis (saídas).
          </p>
        </div>

        {/* Faixa de Resumo (Não aplicável para Gastos, mas mantemos o layout) */}
        <Card className="bg-card border-border shadow-xl">
          <CardContent className="flex justify-between items-center p-4">
            <span className="text-lg font-semibold text-foreground">
              Total de Categorias Cadastradas
            </span>
            <span className="text-3xl font-extrabold text-red-400">
              {expenseCategories.length}
            </span>
          </CardContent>
        </Card>

        {/* Lista de Categorias e Formulário Inline */}
        <Card className="bg-sidebar border-sidebar-border text-sidebar-foreground">
          <CardHeader className="p-4">
            <CardTitle className="text-xl font-bold flex items-center">
                <Tag className="w-5 h-5 mr-2 text-red-500" />
                Categorias Cadastradas
            </CardTitle>
            <Separator className="my-4 bg-sidebar-border" />
          </CardHeader>
          <CardContent className="p-4">
            <ExpenseCategoryManagementContent />
          </CardContent>
        </Card>
      </div>
      
      {/* Não adicionamos FAB, pois a adição é feita no formulário inline no topo da lista. */}
    </Layout>
  );
};

export default GestaoDeGastos;