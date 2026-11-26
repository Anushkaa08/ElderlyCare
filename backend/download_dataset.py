import kagglehub
import os

path = kagglehub.dataset_download("sulianova/cardiovascular-disease-dataset")

print("Dataset downloaded at:", path)
print("Files:", os.listdir(path))