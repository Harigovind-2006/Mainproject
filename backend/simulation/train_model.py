import sys
import os
from pathlib import Path
from typing import Optional
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib

BASE_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BASE_DIR))

def train_and_evaluate(
    csv_path: Optional[str] = None,
    output_model_path: Optional[str] = None
):
    dataset_file = csv_path or str(BASE_DIR / "data" / "simulation_dataset.csv")
    if not os.path.exists(dataset_file):
        print(f"Dataset not found at {dataset_file}. Generating simulation dataset first...")
        from simulation.simulate_dataset import run_simulation
        df = run_simulation(num_runs=120)
    else:
        df = pd.read_csv(dataset_file)

    print(f"Loaded raw dataset with {len(df)} rows.")

    # 1. Preprocessing: Filter ONLY honest uncorrected rows (correction_mode == 'off')
    df_uncorrected = df[df["correction_mode"] == "off"].copy()
    print(f"Filtered to uncorrected runs: {len(df_uncorrected)} rows.")

    # 2. Preprocessing: Drop the first few ticks of each run (lag features stabilization)
    df_clean = df_uncorrected[df_uncorrected["tick"] >= 4].copy()
    print(f"After dropping initial lag warmup ticks (tick >= 4): {len(df_clean)} rows.")

    # 3. Train/Test split STRICTLY BY run_id to prevent temporal data leakage
    unique_runs = df_clean["run_id"].unique()
    np.random.seed(42)
    np.random.shuffle(unique_runs)

    split_idx = int(0.8 * len(unique_runs))
    train_runs = unique_runs[:split_idx]
    test_runs = unique_runs[split_idx:]

    train_df = df_clean[df_clean["run_id"].isin(train_runs)]
    test_df = df_clean[df_clean["run_id"].isin(test_runs)]

    print(f"Split runs: {len(train_runs)} train runs ({len(train_df)} rows), {len(test_runs)} test runs ({len(test_df)} rows).")

    # Features and Target
    feature_cols = [
        "delta_T",
        "delta_T_lag1",
        "delta_T_lag2",
        "delta_T_lag3",
        "actual_speed",
        "distance_remaining",
        "in_turn"
    ]
    target_col = "ideal_speed"

    X_train = train_df[feature_cols]
    y_train = train_df[target_col]
    X_test = test_df[feature_cols]
    y_test = test_df[target_col]

    # Baseline 1: Linear Regression
    print("\n--- Training Naive Baseline: Linear Regression ---")
    lr = LinearRegression()
    lr.fit(X_train, y_train)
    y_pred_lr = lr.predict(X_test)

    mae_lr = mean_absolute_error(y_test, y_pred_lr)
    rmse_lr = np.sqrt(mean_squared_error(y_test, y_pred_lr))
    r2_lr = r2_score(y_test, y_pred_lr)

    # Primary Model: Random Forest Regressor
    print("--- Training Primary Model: Random Forest Regressor (100 trees) ---")
    rf = RandomForestRegressor(
        n_estimators=100,
        max_depth=15,
        min_samples_split=5,
        n_jobs=-1,
        random_state=42
    )
    rf.fit(X_train, y_train)
    y_pred_rf = rf.predict(X_test)

    mae_rf = mean_absolute_error(y_test, y_pred_rf)
    rmse_rf = np.sqrt(mean_squared_error(y_test, y_pred_rf))
    r2_rf = r2_score(y_test, y_pred_rf)

    # Quantitative Comparison Report
    print("\n========================================================")
    print("      SPEED CORRECTION MODEL EVALUATION BENCHMARK       ")
    print("========================================================")
    print(f"{'Metric':<15} | {'Linear Regression (Naive)':<25} | {'Random Forest (Primary)':<25}")
    print("-" * 72)
    print(f"{'MAE (m/s)':<15} | {mae_lr:<25.4f} | {mae_rf:<25.4f}")
    print(f"{'RMSE (m/s)':<15} | {rmse_lr:<25.4f} | {rmse_rf:<25.4f}")
    print(f"{'R² Score':<15} | {r2_lr:<25.4f} | {r2_rf:<25.4f}")
    error_reduction = ((mae_lr - mae_rf) / mae_lr) * 100.0
    print("-" * 72)
    print(f"Random Forest MAE Error Reduction over Naive Baseline: {error_reduction:.2f}%\n")

    # Feature importances
    print("Random Forest Feature Importances:")
    for feat, imp in sorted(zip(feature_cols, rf.feature_importances_), key=lambda x: x[1], reverse=True):
        print(f"  - {feat:<20}: {imp:.4f}")

    # Export model artifact
    save_path = output_model_path or str(BASE_DIR / "models" / "rf_model.joblib")
    os.makedirs(os.path.dirname(save_path), exist_ok=True)
    joblib.dump(rf, save_path)
    print(f"\nTrained model successfully exported to: {save_path}")

    return {
        "linear_regression": {"mae": mae_lr, "rmse": rmse_lr, "r2": r2_lr},
        "random_forest": {"mae": mae_rf, "rmse": rmse_rf, "r2": r2_rf},
        "error_reduction_pct": error_reduction
    }

if __name__ == "__main__":
    from typing import Optional
    train_and_evaluate()
