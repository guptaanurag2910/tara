from django import forms

from .models import Game


class GameQuestionUploadForm(forms.Form):
    game_name = forms.CharField(
        max_length=120,
        required=False,
        initial="Imported Questions",
        help_text="Questions will be imported into this game.",
    )
    game_type = forms.ChoiceField(
        required=False,
        choices=Game.Type.choices,
        initial=Game.Type.CHOICE,
        help_text="Used only when the game is created for the first time.",
    )
    json_file = forms.FileField(
        help_text="Upload a JSON file with an array of question objects.",
    )
