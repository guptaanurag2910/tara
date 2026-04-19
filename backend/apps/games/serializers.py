from rest_framework import serializers

from .models import Game


class GameListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Game
        fields = ["id", "name", "emoji", "description", "type"]
        read_only_fields = fields


class StartGameSessionSerializer(serializers.Serializer):
    match_id = serializers.IntegerField(min_value=1)
    category = serializers.SlugField()


class GameStartQuestionSerializer(serializers.Serializer):
    id = serializers.IntegerField()
    question_text = serializers.CharField()
    options = serializers.ListField(child=serializers.JSONField())
    game_type = serializers.CharField()


class StartGameSessionResponseSerializer(serializers.Serializer):
    session_id = serializers.IntegerField()
    category = serializers.CharField()
    questions = GameStartQuestionSerializer(many=True)


class CurrentQuestionSerializer(serializers.Serializer):
    question_id = serializers.IntegerField(required=False, allow_null=True)
    question_text = serializers.CharField(allow_null=True)
    options = serializers.ListField(child=serializers.CharField())


class SubmitGameAnswerSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(min_value=1)
    question_id = serializers.IntegerField(min_value=1)
    selected_option = serializers.IntegerField(min_value=1, required=False, allow_null=True)
    text_answer = serializers.CharField(required=False, allow_blank=True)


class RespondGameSerializer(serializers.Serializer):
    session_id = serializers.IntegerField(min_value=1)
    question_id = serializers.IntegerField(min_value=1)
    selected_option = serializers.IntegerField(min_value=1)
