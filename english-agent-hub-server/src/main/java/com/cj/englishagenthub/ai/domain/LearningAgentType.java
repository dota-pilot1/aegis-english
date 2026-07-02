package com.cj.englishagenthub.ai.domain;

import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;

import java.util.Arrays;
import java.util.List;

public enum LearningAgentType {
    DEBATE(
            "debate",
            "미국 친구",
            "American Friend",
            "미국에 사는 친구와 일상 주제로 가볍게 영어 대화를 연습합니다.",
            "B1-B2",
            "오늘 있었던 일이나 관심사를 영어로 편하게 말하기",
            List.of("Small Talk", "Daily Life", "Natural Phrases"),
            List.of(
                    "How was your day?",
                    "What do you usually do on weekends?",
                    "Tell me about life in the U.S."
            ),
            "You are a friendly American friend helping a Korean learner practice casual English conversation. " +
                    "Talk naturally like a real friend, not like a teacher or debate coach. " +
                    "Always answer the learner's latest message directly and specifically before anything else. " +
                    "If the learner asks your name, say your name. If they ask a direct question, answer it directly. " +
                    "For the first message of a new session, give a simple friendly greeting only when the learner has not asked a specific question. " +
                    "The user may speak Korean or English. If the user speaks Korean, understand the meaning and reply in natural English. " +
                    "Keep every reply very short: 1 to 3 short sentences only, no lists, no paragraphs, and no long explanations. " +
                    "Do not suggest what the learner can say unless they ask for help, seem stuck, or explicitly request a natural expression. " +
                    "Do not correct every mistake. " +
                    "Ask only one simple follow-up question to keep the conversation going. " +
                    "Do not use formal structures like Summary, Opinion, Evidence, or Counterargument unless the user explicitly asks for debate practice. " +
                    "Talk about everyday topics such as weather, food, hobbies, work, school, travel, culture, and daily life in the U.S."
    );

    private final String id;
    private final String title;
    private final String subtitle;
    private final String description;
    private final String level;
    private final String sessionGoal;
    private final List<String> skills;
    private final List<String> starterPrompts;
    private final String systemPrompt;

    LearningAgentType(
            String id,
            String title,
            String subtitle,
            String description,
            String level,
            String sessionGoal,
            List<String> skills,
            List<String> starterPrompts,
            String systemPrompt
    ) {
        this.id = id;
        this.title = title;
        this.subtitle = subtitle;
        this.description = description;
        this.level = level;
        this.sessionGoal = sessionGoal;
        this.skills = skills;
        this.starterPrompts = starterPrompts;
        this.systemPrompt = systemPrompt;
    }

    public String id() {
        return id;
    }

    public String title() {
        return title;
    }

    public String subtitle() {
        return subtitle;
    }

    public String description() {
        return description;
    }

    public String level() {
        return level;
    }

    public String sessionGoal() {
        return sessionGoal;
    }

    public List<String> skills() {
        return skills;
    }

    public List<String> starterPrompts() {
        return starterPrompts;
    }

    public String systemPrompt() {
        return systemPrompt;
    }

    public static LearningAgentType fromId(String id) {
        return Arrays.stream(values())
                .filter(type -> type.id.equals(id))
                .findFirst()
                .orElseThrow(() -> new BusinessException(ErrorCode.AI_AGENT_NOT_FOUND));
    }
}
