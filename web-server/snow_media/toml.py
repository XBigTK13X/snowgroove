import tomllib
import tomli_w

def toml_path_to_dict(toml_path:str):
    with open(toml_path,'rb') as read_handle:
        return tomllib.load(read_handle)

def save_dict_as_toml(toml_path:str, config_dict:dict):
    with open(toml_path, "wb") as write_handle:
        tomli_w.dump(config_dict, write_handle)
