# 🎯 Learned Confidence Feature Guide

## What Is This?

Your model now learns to predict **how confident it should be** about each prediction. No hand-crafted rules - the neural network learns from data patterns when predictions are reliable vs unreliable.

## How It Works

### The Model Learns
- **During Training**: The confidence head observes which types of matches are predictable
- **Pattern Recognition**: It learns that certain features (team strength, form, ratings) lead to reliable predictions
- **Self-Assessment**: The model becomes self-aware of when it should be confident

### Confidence Levels (Color Coded)

| Color | Range | Meaning | Action |
|-------|-------|---------|--------|
| 🟢 Green | 80-100% | **High Trust** | These are your best bets! |
| 🟡 Yellow | 60-79% | **Medium Trust** | Proceed with caution |
| 🟠 Orange | 40-59% | **Low Trust** | Uncertain predictions |
| 🔴 Red | 0-39% | **Very Low Trust** | Avoid these matches |

## How to Use

### 1. Train a Confidence-Aware Model

```bash
tsx server/train-confidence-model.ts
```

This creates a new model that outputs both predictions AND confidence scores.

### 2. Generate Predictions

In the **Tester** tab:
1. Add match data
2. Click the **"Predict"** button
3. View predictions with colored confidence badges

### 3. Interpret Results

- **Focus on High Confidence (Green)**: The model has identified clear patterns
- **Be Cautious with Medium (Yellow)**: Mixed signals in the data
- **Avoid Low/Very Low (Orange/Red)**: The model is uncertain

## Command Line Tools

### Train Confidence Model
```bash
tsx server/train-confidence-model.ts
```
Creates a model with learned confidence output.

### Generate Predictions (Command Line)
```bash
tsx server/generate-confidence-predictions.ts
```
Shows predictions grouped by confidence level.

## Key Differences from Regular Models

| Feature | Regular Model | Confidence-Aware Model |
|---------|--------------|----------------------|
| Confidence | Max probability from softmax | **Learned by neural network** |
| Training | 5 outputs | **6 outputs (includes confidence)** |
| Learning | Match outcomes only | **Outcomes + prediction reliability** |
| File Marker | None | `model_type.txt` file |

## Technical Details

### Architecture
- **Dedicated Confidence Head**: Separate neural network branch
- **Custom Loss Function**: Rewards high confidence when correct, low when wrong
- **Meta-Learning**: The model learns about its own prediction quality

### Model Detection
The system automatically detects confidence-aware models by checking for `model_type.txt` in the model directory:
- ✨ **Found**: Uses learned confidence
- 📊 **Not Found**: Falls back to max probability confidence

## Tips for Best Results

1. **Train on Diverse Data**: More matches = better confidence calibration
2. **Focus on Green Badges**: These have the highest success rate
3. **Combine with Other Factors**: Use confidence as one factor in your decision
4. **Monitor Calibration**: Track how often high-confidence predictions are correct

## What Makes This Special

🚫 **No Rules**: The model learns everything from data  
✅ **Pure Learning**: Neural network discovers confidence patterns  
🎯 **Self-Aware**: Model knows when it doesn't know  
📊 **Transparent**: Always shows confidence level  

---

**The model now tells you: "I'm confident about this" vs "This one is uncertain" - all learned from your data!**
