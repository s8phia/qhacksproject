import sys
import json
import pandas as pd

def safe_mean(series):
    return None if series.empty else float(series.mean())

def main():
    if len(sys.argv) < 2:
        print(json.dumps({"error": "csv_path_required"}))
        sys.exit(1)

    csv_path = sys.argv[1]

    df = pd.read_csv(
        csv_path,
        usecols=["timestamp", "profit_loss", "quantity", "entry_price"],
    )

    df["timestamp"] = pd.to_datetime(df["timestamp"], errors="coerce")
    for col in ["profit_loss", "quantity", "entry_price"]:
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["timestamp", "profit_loss", "quantity", "entry_price"])

    trades_per_hour = df.groupby(df["timestamp"].dt.floor("h")).size()
    avg_trades_per_hour = float(trades_per_hour.mean()) if not trades_per_hour.empty else 0.0
    max_trades_in_one_hour = int(trades_per_hour.max()) if not trades_per_hour.empty else 0

    wins = df.loc[df["profit_loss"] > 0, "profit_loss"]
    losses = df.loc[df["profit_loss"] < 0, "profit_loss"].abs()
    avg_win = safe_mean(wins)
    avg_abs_loss = safe_mean(losses)
    disposition_ratio = None
    if avg_win is not None and avg_win != 0 and avg_abs_loss is not None:
        disposition_ratio = float(avg_abs_loss / avg_win)

    trade_value = df["quantity"] * df["entry_price"]
    prev_loss_mask = df["profit_loss"].shift(1) < 0
    avg_trade_value_overall = float(trade_value.mean()) if not trade_value.empty else 0.0
    avg_trade_value_after_loss = (
        float(trade_value[prev_loss_mask].mean()) if prev_loss_mask.any() else 0.0
    )
    revenge_trade_value_ratio = (
        float(avg_trade_value_after_loss / avg_trade_value_overall)
        if avg_trade_value_overall != 0
        else None
    )

    result = {
        "overtrading": {
            "avg_trades_per_hour": avg_trades_per_hour,
            "max_trades_in_one_hour": max_trades_in_one_hour,
        },
        "loss_aversion": {
            "avg_abs_loss": avg_abs_loss,
            "avg_win": avg_win,
            "disposition_ratio": disposition_ratio,
        },
        "revenge_trading": {
            "avg_trade_value_after_loss": avg_trade_value_after_loss,
            "avg_trade_value_overall": avg_trade_value_overall,
            "revenge_trade_value_ratio": revenge_trade_value_ratio,
        },
    }

    print(json.dumps(result))

if __name__ == "__main__":
    main()
