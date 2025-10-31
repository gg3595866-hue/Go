import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Brain, CheckCircle2, XCircle, TrendingUp, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { ModelMetadata } from "@shared/schema";

export default function TrainingPage() {
  const { toast } = useToast();
  const [trainingConfig, setTrainingConfig] = useState({
    epochs: 30,
    batchSize: 32,
    validationSplit: 0.2,
    learningRate: 0.001,
    teamEmbeddingSize: 50,
    leagueEmbeddingSize: 20,
    countryEmbeddingSize: 10,
  });

  // Fetch all models
  const { data: models = [], isLoading: modelsLoading } = useQuery<ModelMetadata[]>({
    queryKey: ['/api/ml/models'],
  });

  // Fetch active model
  const { data: activeModel } = useQuery<ModelMetadata>({
    queryKey: ['/api/ml/models/active'],
  });

  // Training mutation
  const trainMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/ml/train', {
        method: 'POST',
        body: JSON.stringify(trainingConfig),
      });
    },
    onSuccess: (data) => {
      toast({
        title: "Training Completed",
        description: `Model trained successfully with ${(data.metrics.validationAccuracy * 100).toFixed(1)}% validation accuracy`,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models/active'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Training Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Activate model mutation
  const activateMutation = useMutation({
    mutationFn: async (modelId: number) => {
      return await apiRequest(`/api/ml/models/${modelId}/activate`, {
        method: 'POST',
      });
    },
    onSuccess: () => {
      toast({
        title: "Model Activated",
        description: "The selected model is now active for predictions",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models/active'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Activation Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete all models mutation
  const deleteAllMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('/api/ml/models', {
        method: 'DELETE',
      });
    },
    onSuccess: () => {
      toast({
        title: "Models Deleted",
        description: "All saved models have been deleted successfully",
      });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models'] });
      queryClient.invalidateQueries({ queryKey: ['/api/ml/models/active'] });
    },
    onError: (error: Error) => {
      toast({
        title: "Deletion Failed",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleTrain = () => {
    trainMutation.mutate();
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Brain className="w-8 h-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold" data-testid="text-page-title">Model Training</h1>
          <p className="text-muted-foreground">Train neural network models for match prediction</p>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Training Configuration */}
        <Card>
          <CardHeader>
            <CardTitle>Training Configuration</CardTitle>
            <CardDescription>Configure model training parameters</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="epochs">Epochs</Label>
                <Input
                  id="epochs"
                  type="number"
                  value={trainingConfig.epochs}
                  onChange={(e) => setTrainingConfig({ ...trainingConfig, epochs: parseInt(e.target.value) })}
                  min={5}
                  max={100}
                  data-testid="input-epochs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="batchSize">Batch Size</Label>
                <Input
                  id="batchSize"
                  type="number"
                  value={trainingConfig.batchSize}
                  onChange={(e) => setTrainingConfig({ ...trainingConfig, batchSize: parseInt(e.target.value) })}
                  min={8}
                  max={128}
                  data-testid="input-batch-size"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validationSplit">Validation Split</Label>
                <Input
                  id="validationSplit"
                  type="number"
                  step="0.1"
                  value={trainingConfig.validationSplit}
                  onChange={(e) => setTrainingConfig({ ...trainingConfig, validationSplit: parseFloat(e.target.value) })}
                  min={0.1}
                  max={0.5}
                  data-testid="input-validation-split"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="learningRate">Learning Rate</Label>
                <Input
                  id="learningRate"
                  type="number"
                  step="0.0001"
                  value={trainingConfig.learningRate}
                  onChange={(e) => setTrainingConfig({ ...trainingConfig, learningRate: parseFloat(e.target.value) })}
                  min={0.0001}
                  max={0.01}
                  data-testid="input-learning-rate"
                />
              </div>
            </div>

            <div className="pt-4">
              <Button
                onClick={handleTrain}
                disabled={trainMutation.isPending}
                className="w-full"
                data-testid="button-start-training"
              >
                {trainMutation.isPending ? (
                  <>Training Model...</>
                ) : (
                  <>
                    <Brain className="w-4 h-4 mr-2" />
                    Start Training
                  </>
                )}
              </Button>
            </div>

            {trainMutation.isPending && (
              <div className="space-y-2">
                <Progress value={undefined} className="w-full" />
                <p className="text-sm text-muted-foreground text-center">
                  Training in progress... This may take several minutes.
                </p>
              </div>
            )}

            {trainMutation.isSuccess && (
              <div className="p-4 bg-green-50 dark:bg-green-950 rounded-md space-y-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
                  <p className="font-medium text-green-900 dark:text-green-100">Training Completed</p>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <p className="text-muted-foreground">Training Accuracy:</p>
                    <p className="font-medium" data-testid="text-training-accuracy">
                      {(trainMutation.data.metrics.trainingAccuracy * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Validation Accuracy:</p>
                    <p className="font-medium" data-testid="text-validation-accuracy">
                      {(trainMutation.data.metrics.validationAccuracy * 100).toFixed(1)}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Samples:</p>
                    <p className="font-medium" data-testid="text-total-samples">
                      {trainMutation.data.totalSamples.toLocaleString()}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Loss:</p>
                    <p className="font-medium" data-testid="text-loss">
                      {trainMutation.data.metrics.loss.toFixed(4)}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Model History */}
        <Card>
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Model History</CardTitle>
                <CardDescription>Trained models and their performance</CardDescription>
              </div>
              {models.length > 0 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={deleteAllMutation.isPending}
                      data-testid="button-delete-all-models"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Delete All
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete All Models?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete all {models.length} saved model(s). This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteAllMutation.mutate()}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Delete All Models
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {modelsLoading ? (
              <p className="text-muted-foreground">Loading models...</p>
            ) : models.length === 0 ? (
              <div className="text-center py-8">
                <Brain className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                <p className="text-muted-foreground">No models trained yet</p>
                <p className="text-sm text-muted-foreground">Start training to create your first model</p>
              </div>
            ) : (
              <div className="space-y-3">
                {models.map((model) => (
                  <Card key={model.id} className={model.isActive ? "border-primary" : ""}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center gap-2">
                            <p className="font-medium" data-testid={`text-model-name-${model.id}`}>
                              {model.modelName}
                            </p>
                            {model.isActive && (
                              <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                Active
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            Version {model.version} • {new Date(model.trainingDate).toLocaleDateString()}
                          </p>
                          <div className="grid grid-cols-2 gap-2 text-sm mt-2">
                            <div>
                              <p className="text-muted-foreground">Val. Accuracy:</p>
                              <p className="font-medium text-green-600 dark:text-green-400">
                                {model.validationAccuracy ? (model.validationAccuracy * 100).toFixed(1) : 'N/A'}%
                              </p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Samples:</p>
                              <p className="font-medium">{model.totalSamples.toLocaleString()}</p>
                            </div>
                          </div>
                        </div>
                        {!model.isActive && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => activateMutation.mutate(model.id)}
                            disabled={activateMutation.isPending}
                            data-testid={`button-activate-${model.id}`}
                          >
                            Activate
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Active Model Info */}
      {activeModel && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5" />
              Active Model Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Model Name</p>
                <p className="font-medium" data-testid="text-active-model-name">{activeModel.modelName}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Training Accuracy</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {activeModel.trainingAccuracy ? (activeModel.trainingAccuracy * 100).toFixed(1) : 'N/A'}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Validation Accuracy</p>
                <p className="font-medium text-green-600 dark:text-green-400">
                  {activeModel.validationAccuracy ? (activeModel.validationAccuracy * 100).toFixed(1) : 'N/A'}%
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Samples</p>
                <p className="font-medium">{activeModel.totalSamples.toLocaleString()}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
