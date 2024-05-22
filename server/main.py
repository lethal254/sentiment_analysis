from flask import Flask, request, jsonify, send_file, render_template
import re
from io import BytesIO
from flask_cors import CORS


# nltk.download('stopwords')
from nltk.corpus import stopwords
from nltk.stem.porter import PorterStemmer
import matplotlib.pyplot as plt
import matplotlib

matplotlib.use('Agg')

import pandas as pd
import pickle
import base64

STOPWORDS = set(stopwords.words("english"))

app = Flask(__name__)
CORS(app)  # This will enable CORS for all routes



@app.route("/test", methods=["GET"])
def test():
    return "Test request received successfully. Service is running."



@app.route("/predict", methods=["POST"])
def predict():
    # Select the predictor to be loaded from Models folder
    predictor = pickle.load(open(r"../Models/model_xgb.pkl", "rb"))
    scaler = pickle.load(open(r"../Models/scaler.pkl", "rb"))
    cv = pickle.load(open(r"../Models/countVectorizer.pkl", "rb"))
    try:
        # Check if the request contains a file (for bulk prediction) or text input
        if "file" in request.files:
            # Bulk prediction from CSV file
            file = request.files["file"]
            data = pd.read_csv(file,low_memory=False)

            predictions, graph = bulk_prediction(predictor, scaler, cv, data)

            response = send_file(
                predictions,
                mimetype="text/csv",
                as_attachment=True,
                download_name="Predictions.csv",
            )

            response.headers["X-Graph-Exists"] = "true"

            response.headers["X-Graph-Data"] = base64.b64encode(
                graph.getbuffer()
            ).decode("ascii")

            return response

        elif "text" in request.json:
            # Single string prediction
            text_input = request.json["text"]
            predicted_sentiment = single_prediction(predictor, scaler, cv, text_input)

            return jsonify({"prediction": predicted_sentiment})

    except Exception as e:
        print(e)
        return jsonify({"error": str(e)})


def single_prediction(predictor, scaler, cv, text_input):
    corpus = []
    stemmer = PorterStemmer()
    review = re.sub("[^a-zA-Z]", " ", text_input)
    review = review.lower().split()
    review = [stemmer.stem(word) for word in review if not word in STOPWORDS]
    review = " ".join(review)
    corpus.append(review)
    X_prediction = cv.transform(corpus).toarray()
    X_prediction_scl = scaler.transform(X_prediction)
    y_predictions = predictor.predict_proba(X_prediction_scl)
    print(y_predictions)
    y_predictions = y_predictions.argmax(axis=1)[0]
    print(y_predictions)

    if y_predictions == 0:
        return "NEGATIVE"
    elif y_predictions == 1:
        return "NEUTRAL"
    elif y_predictions == 2:
        return "POSITIVE"


def bulk_prediction(predictor, scaler, cv, data):
    corpus = []
    stemmer = PorterStemmer()

    for i in range(data.shape[0]):
        # Convert each entry to a string and handle missing values
        review = str(data.iloc[i]["reviews.text"])
        
        # Skip any empty strings that result from conversion of NaN or other non-string values
        if review.strip() == '':
            continue
        
        review = re.sub("[^a-zA-Z]", " ", review)
        review = review.lower().split()
        review = [stemmer.stem(word) for word in review if word not in STOPWORDS]
        review = " ".join(review)
        corpus.append(review)

    # Debug: Print the preprocessed corpus
    print(f"Preprocessed corpus: {corpus}")

    X_prediction = cv.transform(corpus).toarray()
    X_prediction_scl = scaler.transform(X_prediction)
    y_predictions = predictor.predict_proba(X_prediction_scl)
    y_predictions = y_predictions.argmax(axis=1)
    
    # Debug: Print the raw predictions
    print(f"Raw predictions: {y_predictions}")

    y_predictions = list(map(sentiment_mapping, y_predictions))
    
    # Debug: Print the mapped predictions
    print(f"Mapped predictions: {y_predictions}")

    data["Predicted sentiment"] = y_predictions

    # Save predictions to CSV
    predictions_csv = BytesIO()
    data.to_csv(predictions_csv, index=False)
    predictions_csv.seek(0)

    # Generate the distribution graph
    graph = get_distribution_graph(data)

    return predictions_csv, graph



def get_distribution_graph(data):
    fig = plt.figure(figsize=(5, 5))
    colors = ("green", "red")
    wp = {"linewidth": 1, "edgecolor": "black"}
    tags = data["Predicted sentiment"].value_counts()
    explode = [0.01] * len(tags)

    tags.plot(
        kind="pie",
        autopct="%1.1f%%",
        shadow=True,
        colors=colors,
        startangle=90,
        wedgeprops=wp,
        explode=explode,
        title="Sentiment Distribution",
        xlabel="",
        ylabel="",
    )

    graph = BytesIO()
    plt.savefig(graph, format="png")
    plt.close()

    return graph


def sentiment_mapping(x):
    if x == 0:
        return "NEGATIVE"
    elif x == 1:
        return "NEUTRAL"
    else:
        return "POSITIVE"


if __name__ == "__main__":
    app.run(port=5000, debug=True)